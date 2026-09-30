import type { Member, Plan, Subscription } from '@prisma/client';
import {
  computeAttendanceStats,
  formatMemberCode,
  isMemberActive,
  normalizePhone,
  toCents,
  type MemberCreateInput,
  type MemberDetail,
  type MemberListItem,
  type MemberListQuery,
  type MemberUpdateInput,
  type SubscriptionStatus,
} from '@gymflow/shared';
import { audit, diff } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import type { GymContext } from '../../lib/gym';
import { evaluate, paymentInclude, toAttendanceDTO, toMemberDTO, toNotificationDTO, toPaymentDTO, toSubscriptionDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { emptyToNull, normalizeSearch, paginate, randomToken } from '../../lib/utils';
import { registerPayment } from '../payments/service';
import { createSubscriptionPeriod, subscriptionInclude } from '../subscriptions/service';

type Actor = { id: string; name: string; ip: string | null };

export type MemberWithCurrent = Member & { currentSubscription: (Subscription & { plan: Pick<Plan, 'id' | 'name' | 'durationDays'> }) | null };

/** Carrega todos os membros com o estado calculado (base para listas, dashboard e relatórios). */
export async function loadMembersWithStatus(ctx: GymContext): Promise<{ member: MemberWithCurrent; item: MemberListItem }[]> {
  const members = await prisma.member.findMany({
    where: { gymId: ctx.gym.id },
    include: { currentSubscription: { include: { plan: { select: { id: true, name: true, durationDays: true } } } } },
  });
  return members.map((member) => ({ member, item: toMemberListItem(member, ctx) }));
}

export function toMemberListItem(m: MemberWithCurrent, ctx: GymContext): MemberListItem {
  const sub = m.currentSubscription;
  const e = sub ? evaluate(sub, ctx) : null;
  const status: SubscriptionStatus | null = e?.status ?? null;
  return {
    id: m.id,
    code: m.code,
    fullName: m.fullName,
    phone: m.phone,
    email: m.email,
    planId: sub?.plan.id ?? null,
    planName: sub?.plan.name ?? null,
    joinedAt: m.joinedAt,
    dueDate: e?.dueDate ?? null,
    endDate: sub?.endDate ?? null,
    status,
    active: m.active,
    isActive: isMemberActive(m.active, status),
    lastPaymentDate: m.lastPaymentDate,
    subscriptionId: sub?.id ?? null,
    notificationsEnabled: m.notificationsEnabled,
  };
}

const STATUS_ORDER: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, ACTIVE: 2, EXPIRED: 3, SUSPENDED: 4, CANCELLED: 5, none: 6 };

export function matchesMemberFilter(item: MemberListItem, filter: MemberListQuery['filter'], today: string): boolean {
  switch (filter) {
    case 'active':
      return item.isActive;
    case 'inactive':
      return !item.isActive;
    case 'up_to_date':
      return item.status === 'ACTIVE' || item.status === 'DUE_SOON';
    case 'overdue':
      return item.status === 'OVERDUE';
    case 'due_today':
      return item.dueDate === today && item.status === 'DUE_SOON';
    case 'due_7_days':
      return item.status === 'DUE_SOON';
    default:
      return true;
  }
}

export async function listMembers(ctx: GymContext, query: Required<Pick<MemberListQuery, 'filter' | 'sort' | 'order'>> & MemberListQuery & { page: number; pageSize: number }) {
  const all = await loadMembersWithStatus(ctx);
  const term = query.q ? normalizeSearch(query.q) : '';
  const digits = query.q?.replace(/\D/g, '') ?? '';

  const items = all
    .filter(({ member, item }) => {
      if (query.planId && member.currentSubscription?.planId !== query.planId) return false;
      if (!matchesMemberFilter(item, query.filter, ctx.today)) return false;
      if (!term) return true;
      return (
        normalizeSearch(`${item.fullName} ${item.code} ${item.email ?? ''}`).includes(term) || (digits.length >= 3 && item.phone.includes(digits))
      );
    })
    .map((x) => x.item);

  const dir = query.order === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    let r = 0;
    switch (query.sort) {
      case 'joinedAt':
        r = a.joinedAt.localeCompare(b.joinedAt);
        break;
      case 'dueDate':
        r = (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
        break;
      case 'status':
        r = STATUS_ORDER[a.status ?? 'none'] - STATUS_ORDER[b.status ?? 'none'];
        break;
      case 'lastPayment':
        r = (a.lastPaymentDate ?? '').localeCompare(b.lastPaymentDate ?? '');
        break;
      default:
        r = a.fullName.localeCompare(b.fullName, 'pt');
    }
    return r * dir || a.fullName.localeCompare(b.fullName, 'pt');
  });

  return paginate(items, query.page, query.pageSize);
}

export async function getMemberDetail(ctx: GymContext, id: string): Promise<MemberDetail> {
  const member = await prisma.member.findFirst({
    where: { id, gymId: ctx.gym.id },
    include: {
      subscriptions: { include: subscriptionInclude, orderBy: { startDate: 'desc' } },
      payments: { include: paymentInclude, orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }] },
      notifications: { orderBy: { createdAt: 'desc' }, take: 100 },
      attendances: { include: { registeredBy: { select: { id: true, name: true } } }, orderBy: { checkInAt: 'desc' } },
    },
  });
  if (!member) throw notFound('Membro não encontrado');

  const subscriptions = member.subscriptions.map((s) => {
    const last = member.payments.find((p) => p.subscriptionId === s.id && p.status === 'PAID');
    return toSubscriptionDTO(s, ctx, last?.paymentDate ?? null);
  });
  return {
    ...toMemberDTO(member),
    currentSubscription: subscriptions.find((s) => s.id === member.currentSubscriptionId) ?? null,
    subscriptions,
    payments: member.payments.map(toPaymentDTO),
    notifications: member.notifications.map(toNotificationDTO),
    attendance: member.attendances.slice(0, 50).map(toAttendanceDTO),
    attendanceStats: computeAttendanceStats(
      member.attendances.map((a) => a.date),
      ctx.today,
      member.joinedAt,
    ),
    totalPaidCents: member.payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amountCents, 0),
  };
}

function personalData(input: Partial<MemberCreateInput & MemberUpdateInput>) {
  return {
    ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
    ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {}),
    ...(input.email !== undefined ? { email: emptyToNull(input.email)?.toLowerCase() ?? null } : {}),
    ...(input.birthDate !== undefined ? { birthDate: emptyToNull(input.birthDate) } : {}),
    ...(input.gender !== undefined ? { gender: emptyToNull(input.gender) } : {}),
    ...(input.address !== undefined ? { address: emptyToNull(input.address) } : {}),
    ...(input.emergencyContactName !== undefined ? { emergencyContactName: emptyToNull(input.emergencyContactName) } : {}),
    ...(input.emergencyContactPhone !== undefined
      ? { emergencyContactPhone: emptyToNull(input.emergencyContactPhone) ? normalizePhone(input.emergencyContactPhone!) : null }
      : {}),
    ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
    ...(input.joinedAt !== undefined ? { joinedAt: input.joinedAt } : {}),
  };
}

async function assertUniquePhone(gymId: string, phone: string, exceptId?: string) {
  const existing = await prisma.member.findFirst({ where: { gymId, phone, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (existing) throw conflict(`Já existe um membro com este telefone (${existing.code} — ${existing.fullName})`);
}

type ParsedCreate = MemberCreateInput & { registerPayment: boolean; sendWelcome: boolean };

export async function createMember(ctx: GymContext, input: ParsedCreate, actor: Actor) {
  const data = personalData(input);
  await assertUniquePhone(ctx.gym.id, data.phone!);
  if (input.registerPayment && (!input.planId || !input.payment)) throw badRequest('Para registar o pagamento seleccione um plano e o método');

  return prisma.$transaction(async (tx) => {
    const gym = await tx.gym.update({ where: { id: ctx.gym.id }, data: { memberSequence: { increment: 1 } } });
    const code = formatMemberCode(gym.memberCodePrefix, gym.memberSequence);

    const member = await tx.member.create({
      data: {
        gymId: ctx.gym.id,
        code,
        qrToken: randomToken(18),
        fullName: data.fullName!,
        phone: data.phone!,
        email: data.email ?? null,
        birthDate: data.birthDate ?? null,
        gender: data.gender ?? null,
        address: data.address ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        notes: data.notes ?? null,
        joinedAt: input.joinedAt,
      },
    });

    let subscription = null;
    if (input.planId) {
      const plan = await tx.plan.findFirst({ where: { id: input.planId, gymId: ctx.gym.id } });
      if (!plan) throw notFound('Plano não encontrado');
      subscription = await createSubscriptionPeriod(tx, {
        gymId: ctx.gym.id,
        memberId: member.id,
        plan,
        startDate: emptyToNull(input.startDate) ?? input.joinedAt,
        endDate: emptyToNull(input.endDate),
      });
    }

    await audit(
      {
        gymId: ctx.gym.id,
        userId: actor.id,
        action: 'member.create',
        entity: 'Member',
        entityId: member.id,
        summary: `${actor.name} cadastrou o membro ${member.fullName} (${code}).`,
        after: toMemberDTO(member),
        ip: actor.ip,
      },
      tx,
    );

    let payment = null;
    if (input.registerPayment && input.payment && subscription) {
      const result = await registerPayment(tx, ctx, {
        memberId: member.id,
        amountCents: toCents(input.payment.amount),
        paymentDate: ctx.today,
        method: input.payment.method,
        reference: input.payment.reference,
        actor,
      });
      payment = result.payment;
      subscription = result.subscription;
    }

    const fresh = await tx.member.findUniqueOrThrow({ where: { id: member.id } });
    return { member: fresh, subscription, payment };
  });
}

export async function updateMember(ctx: GymContext, id: string, input: MemberUpdateInput, actor: Actor) {
  const existing = await prisma.member.findFirst({ where: { id, gymId: ctx.gym.id } });
  if (!existing) throw notFound('Membro não encontrado');

  const data = {
    ...personalData(input),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.notificationsEnabled !== undefined ? { notificationsEnabled: input.notificationsEnabled } : {}),
  };
  if (data.phone && data.phone !== existing.phone) await assertUniquePhone(ctx.gym.id, data.phone, id);

  const changes = diff(existing as unknown as Record<string, unknown>, data);
  if (changes.changed.length === 0) return toMemberDTO(existing);

  const updated = await prisma.member.update({ where: { id }, data });
  const fieldLabels: Record<string, string> = {
    phone: 'o número de telefone',
    email: 'o email',
    fullName: 'o nome',
    active: 'o estado',
    notificationsEnabled: 'as notificações',
  };
  const what = changes.changed.length === 1 ? (fieldLabels[changes.changed[0]] ?? 'os dados') : 'os dados';
  await audit({
    gymId: ctx.gym.id,
    userId: actor.id,
    action: 'member.update',
    entity: 'Member',
    entityId: id,
    summary: `${actor.name} actualizou ${what} do membro ${existing.code}.`,
    before: changes.before,
    after: changes.after,
    ip: actor.ip,
  });
  return toMemberDTO(updated);
}

export async function getMemberQr(ctx: GymContext, id: string, regenerate: boolean, actor?: Actor) {
  let member = await prisma.member.findFirst({ where: { id, gymId: ctx.gym.id } });
  if (!member) throw notFound('Membro não encontrado');
  if (regenerate) {
    member = await prisma.member.update({ where: { id }, data: { qrToken: randomToken(18) } });
    await audit({
      gymId: ctx.gym.id,
      userId: actor?.id,
      action: 'member.qr_regenerate',
      entity: 'Member',
      entityId: id,
      summary: `${actor?.name ?? 'Sistema'} gerou um novo QR Code para ${member.code}. O anterior deixou de ser válido.`,
      ip: actor?.ip,
    });
  }
  return { memberId: member.id, code: member.code, fullName: member.fullName, qrValue: `GF1:${member.qrToken}` };
}
