import type { Plan } from '@prisma/client';
import {
  computeEndDate,
  pickCurrentSubscription,
  type SubscriptionListQuery,
  type SubscriptionState,
} from '@gymflow/shared';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/errors';
import type { GymContext } from '../../lib/gym';
import { memberRefSelect, toSubscriptionDTO } from '../../lib/mappers';
import { prisma, type Tx } from '../../lib/prisma';
import { normalizeSearch, paginate } from '../../lib/utils';
import { closePaymentLinks } from '../../services/payments/payment-links';

export const subscriptionInclude = {
  plan: { select: { id: true, name: true, durationDays: true } },
  member: { select: memberRefSelect },
} as const;

/**
 * Recalcula os campos desnormalizados do membro: período actual e último pagamento.
 * Deve ser chamado depois de qualquer alteração a subscrições ou pagamentos.
 */
export async function refreshMemberDerived(tx: Tx, memberId: string) {
  const subs = await tx.subscription.findMany({
    where: { memberId },
    select: { id: true, startDate: true, state: true, createdAt: true },
  });
  const current = pickCurrentSubscription(subs.map((s) => ({ ...s, state: s.state as SubscriptionState })));
  const last = await tx.payment.findFirst({
    where: { memberId, status: 'PAID' },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    select: { paymentDate: true },
  });
  await tx.member.update({
    where: { id: memberId },
    data: { currentSubscriptionId: current?.id ?? null, lastPaymentDate: last?.paymentDate ?? null },
  });
}

export async function createSubscriptionPeriod(
  tx: Tx,
  input: { gymId: string; memberId: string; plan: Plan; startDate: string; endDate?: string | null },
) {
  if (!input.plan.active) throw badRequest('O plano seleccionado está inactivo');
  const endDate = input.endDate || computeEndDate(input.startDate, input.plan.durationDays);
  if (endDate < input.startDate) throw badRequest('A data de término deve ser posterior à data de início');
  const sub = await tx.subscription.create({
    data: {
      gymId: input.gymId,
      memberId: input.memberId,
      planId: input.plan.id,
      startDate: input.startDate,
      endDate,
      amountCents: input.plan.priceCents,
    },
    include: subscriptionInclude,
  });
  await refreshMemberDerived(tx, input.memberId);
  return sub;
}

export async function listSubscriptions(ctx: GymContext, query: SubscriptionListQuery & { page: number; pageSize: number }) {
  const members = await prisma.member.findMany({
    where: { gymId: ctx.gym.id, archivedAt: null, currentSubscriptionId: { not: null }, ...(query.planId ? { currentSubscription: { planId: query.planId } } : {}) },
    select: { lastPaymentDate: true, fullName: true, code: true, phone: true, currentSubscription: { include: subscriptionInclude } },
    orderBy: { fullName: 'asc' },
  });
  const term = query.q ? normalizeSearch(query.q) : '';
  const items = members
    .filter((m) => !term || normalizeSearch(`${m.fullName} ${m.code} ${m.phone}`).includes(term))
    .map((m) => toSubscriptionDTO(m.currentSubscription!, ctx, m.lastPaymentDate))
    .filter((s) => !query.status || s.status === query.status)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return paginate(items, query.page, query.pageSize);
}

async function findSubscription(ctx: GymContext, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, gymId: ctx.gym.id }, include: subscriptionInclude });
  if (!sub) throw notFound('Subscrição não encontrada');
  return sub;
}

type Actor = { id: string; name: string; ip: string | null };

export async function changeSubscriptionState(
  ctx: GymContext,
  id: string,
  action: 'suspend' | 'resume' | 'cancel',
  actor: Actor,
  reason?: string | null,
) {
  const sub = await findSubscription(ctx, id);
  if (sub.state === 'CANCELLED') throw badRequest('A subscrição já está cancelada');
  if (action === 'suspend' && sub.state === 'SUSPENDED') throw badRequest('A subscrição já está suspensa');
  if (action === 'resume' && sub.state !== 'SUSPENDED') throw badRequest('A subscrição não está suspensa');

  const data =
    action === 'suspend'
      ? { state: 'SUSPENDED', suspendedAt: new Date(), stateReason: reason ?? null }
      : action === 'resume'
        ? { state: 'NORMAL', suspendedAt: null, stateReason: null }
        : { state: 'CANCELLED', cancelledAt: new Date(), stateReason: reason ?? null };

  const labels = { suspend: 'suspendeu', resume: 'reactivou', cancel: 'cancelou' };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({ where: { id }, data, include: subscriptionInclude });
    if (action === 'cancel') await closePaymentLinks(id, 'CANCELLED', tx);
    await refreshMemberDerived(tx, sub.memberId);
    await audit(
      {
        gymId: ctx.gym.id,
        userId: actor.id,
        action: `subscription.${action}`,
        entity: 'Subscription',
        entityId: id,
        summary: `${actor.name} ${labels[action]} a subscrição ${sub.plan.name} de ${sub.member.code}${reason ? ` (${reason})` : ''}.`,
        before: { state: sub.state },
        after: { state: updated.state, reason },
        ip: actor.ip,
      },
      tx,
    );
    return toSubscriptionDTO(updated, ctx);
  });
}

export async function setRemindersPaused(ctx: GymContext, id: string, paused: boolean, actor: Actor) {
  const sub = await findSubscription(ctx, id);
  const updated = await prisma.subscription.update({ where: { id }, data: { remindersPaused: paused }, include: subscriptionInclude });
  await audit({
    gymId: ctx.gym.id,
    userId: actor.id,
    action: 'subscription.reminders',
    entity: 'Subscription',
    entityId: id,
    summary: `${actor.name} ${paused ? 'suspendeu' : 'retomou'} os lembretes de ${sub.member.code}.`,
    before: { remindersPaused: sub.remindersPaused },
    after: { remindersPaused: paused },
    ip: actor.ip,
  });
  return toSubscriptionDTO(updated, ctx);
}
