import type { Prisma } from '@prisma/client';
import {
  computeEndDate,
  formatMoney,
  isSubscriptionPaid,
  nextPeriodStart,
  PAYMENT_METHODS,
  type PaymentListQuery,
  type PaymentMethod,
  type PaymentSource,
} from '@gymflow/shared';
import { audit } from '../../lib/audit';
import { assertNotArchived, badRequest, notFound } from '../../lib/errors';
import type { GymContext } from '../../lib/gym';
import { paymentInclude, toPaymentDTO } from '../../lib/mappers';
import { prisma, type Tx } from '../../lib/prisma';
import { emptyToNull, pageMeta } from '../../lib/utils';
import { closePaymentLinks } from '../../services/payments/payment-links';
import { createSubscriptionPeriod, refreshMemberDerived, subscriptionInclude } from '../subscriptions/service';

export interface RegisterPaymentInput {
  memberId: string;
  planId?: string | null;
  amountCents: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  source?: PaymentSource;
  externalId?: string | null;
  actor: { id: string; name: string; ip: string | null } | null;
}

async function nextReceiptNumber(tx: Tx, gymId: string) {
  const gym = await tx.gym.update({ where: { id: gymId }, data: { receiptSequence: { increment: 1 } }, select: { receiptSequence: true } });
  return `REC-${String(gym.receiptSequence).padStart(6, '0')}`;
}

/**
 * Regista um pagamento (manual ou, futuramente, online) numa transacção:
 * 1. associa ao período actual por pagar, ou cria o período seguinte (renovação);
 * 2. actualiza o valor pago — o período só fica "pago" quando o total é coberto;
 * 3. regista quem recebeu e cria o audit log.
 */
export async function registerPayment(tx: Tx, ctx: GymContext, input: RegisterPaymentInput) {
  const member = await tx.member.findFirst({
    where: { id: input.memberId, gymId: ctx.gym.id },
    include: { currentSubscription: { include: { plan: true } } },
  });
  if (!member) throw notFound('Membro não encontrado');
  assertNotArchived(member);
  if (input.amountCents <= 0) throw badRequest('O valor deve ser superior a zero');

  const current = member.currentSubscription;
  const planChanged = Boolean(input.planId && current && input.planId !== current.planId);
  let target = current;
  let isRenewal = false;

  const canPayCurrent = current && current.state !== 'CANCELLED' && !isSubscriptionPaid(current);
  if (canPayCurrent && planChanged && current.amountPaidCents === 0) {
    // Período ainda sem pagamentos: pode trocar de plano sem criar novo período.
    const plan = await tx.plan.findFirst({ where: { id: input.planId!, gymId: ctx.gym.id } });
    if (!plan) throw notFound('Plano não encontrado');
    target = await tx.subscription.update({
      where: { id: current.id },
      data: {
        planId: plan.id,
        amountCents: plan.priceCents,
        endDate: computeEndDate(current.startDate, plan.durationDays),
      },
      include: { plan: true },
    });
  } else if (!canPayCurrent || planChanged) {
    const planId = input.planId ?? current?.planId;
    if (!planId) throw badRequest('Seleccione o plano a pagar');
    const plan = await tx.plan.findFirst({ where: { id: planId, gymId: ctx.gym.id } });
    if (!plan) throw notFound('Plano não encontrado');
    const previousEnd = current && current.state !== 'CANCELLED' ? current.endDate : null;
    const startDate = nextPeriodStart(previousEnd, ctx.today, ctx.rules);
    const created = await createSubscriptionPeriod(tx, { gymId: ctx.gym.id, memberId: member.id, plan, startDate });
    target = await tx.subscription.findUniqueOrThrow({ where: { id: created.id }, include: { plan: true } });
    isRenewal = Boolean(current);
  }
  if (!target) throw badRequest('Não foi possível determinar a subscrição');

  const payment = await tx.payment.create({
    data: {
      gymId: ctx.gym.id,
      receiptNumber: await nextReceiptNumber(tx, ctx.gym.id),
      memberId: member.id,
      subscriptionId: target.id,
      amountCents: input.amountCents,
      paymentDate: input.paymentDate,
      method: input.method,
      reference: emptyToNull(input.reference),
      notes: emptyToNull(input.notes),
      source: input.source ?? 'MANUAL',
      externalId: input.externalId ?? null,
      receivedById: input.actor?.id ?? null,
    },
    include: paymentInclude,
  });

  const amountPaidCents = target.amountPaidCents + input.amountCents;
  const nowPaid = amountPaidCents >= target.amountCents;
  const subscription = await tx.subscription.update({
    where: { id: target.id },
    data: { amountPaidCents, paidAt: nowPaid ? (target.paidAt ?? new Date()) : null },
    include: subscriptionInclude,
  });
  if (nowPaid) await closePaymentLinks(target.id, 'PAID', tx);
  await refreshMemberDerived(tx, member.id);

  await audit(
    {
      gymId: ctx.gym.id,
      userId: input.actor?.id,
      action: 'payment.create',
      entity: 'Payment',
      entityId: payment.id,
      summary: `${input.actor?.name ?? 'Sistema'} registou pagamento de ${formatMoney(input.amountCents, ctx.gym.currency)} para ${member.code}.`,
      after: {
        receiptNumber: payment.receiptNumber,
        amountCents: payment.amountCents,
        method: payment.method,
        reference: payment.reference,
        subscriptionId: target.id,
        period: `${subscription.startDate} → ${subscription.endDate}`,
      },
      ip: input.actor?.ip,
    },
    tx,
  );

  return { payment, subscription, member, isRenewal, fullyPaid: nowPaid };
}

export async function cancelPayment(
  ctx: GymContext,
  id: string,
  input: { status: 'CANCELLED' | 'REFUNDED'; reason: string },
  actor: { id: string; name: string; ip: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id, gymId: ctx.gym.id }, include: { member: true } });
    if (!payment) throw notFound('Pagamento não encontrado');
    if (payment.status !== 'PAID') throw badRequest('Este pagamento já foi cancelado ou estornado');

    const updated = await tx.payment.update({
      where: { id },
      data: { status: input.status, cancelReason: input.reason, cancelledAt: new Date(), cancelledById: actor.id },
      include: paymentInclude,
    });

    if (payment.subscriptionId) {
      const sub = await tx.subscription.findUniqueOrThrow({ where: { id: payment.subscriptionId } });
      const amountPaidCents = Math.max(0, sub.amountPaidCents - payment.amountCents);
      await tx.subscription.update({
        where: { id: sub.id },
        data: { amountPaidCents, paidAt: amountPaidCents >= sub.amountCents ? sub.paidAt : null },
      });
    }
    await refreshMemberDerived(tx, payment.memberId);

    await audit(
      {
        gymId: ctx.gym.id,
        userId: actor.id,
        action: input.status === 'REFUNDED' ? 'payment.refund' : 'payment.cancel',
        entity: 'Payment',
        entityId: id,
        summary: `${actor.name} ${input.status === 'REFUNDED' ? 'estornou' : 'cancelou'} o pagamento ${payment.receiptNumber} de ${formatMoney(payment.amountCents, ctx.gym.currency)} (${payment.member.code}): ${input.reason}`,
        before: { status: payment.status },
        after: { status: input.status, reason: input.reason },
        ip: actor.ip,
      },
      tx,
    );
    return toPaymentDTO(updated);
  });
}

export async function listPayments(ctx: GymContext, query: PaymentListQuery & { page: number; pageSize: number }) {
  const where: Prisma.PaymentWhereInput = {
    gymId: ctx.gym.id,
    ...(query.method ? { method: query.method } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(query.from || query.to ? { paymentDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    ...(query.q
      ? {
          OR: [
            { reference: { contains: query.q, mode: 'insensitive' } },
            { receiptNumber: { contains: query.q.toUpperCase(), mode: 'insensitive' } },
            { member: { fullName: { contains: query.q, mode: 'insensitive' } } },
            { member: { code: { contains: query.q.toUpperCase(), mode: 'insensitive' } } },
            { member: { phone: { contains: query.q.replace(/\D/g, '') || query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items, grouped] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.payment.groupBy({ by: ['method'], where: { ...where, status: 'PAID' }, _sum: { amountCents: true }, _count: true }),
  ]);

  const byMethod = PAYMENT_METHODS.map((method) => {
    const g = grouped.find((x) => x.method === method);
    return { method, totalCents: g?._sum.amountCents ?? 0, count: g?._count ?? 0 };
  }).filter((m) => m.count > 0);

  return {
    items: items.map(toPaymentDTO),
    ...pageMeta(total, query.page, query.pageSize),
    summary: {
      totalCents: byMethod.reduce((s, m) => s + m.totalCents, 0),
      count: byMethod.reduce((s, m) => s + m.count, 0),
      byMethod,
    },
  };
}

export async function getPayment(ctx: GymContext, id: string) {
  const payment = await prisma.payment.findFirst({ where: { id, gymId: ctx.gym.id }, include: paymentInclude });
  if (!payment) throw notFound('Pagamento não encontrado');
  return toPaymentDTO(payment);
}

