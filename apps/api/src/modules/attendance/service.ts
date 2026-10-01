import type { Prisma } from '@prisma/client';
import {
  normalizePhone,
  zonedDateTimeToInstant,
  type AttendanceListQuery,
  type AttendanceMethod,
  type CheckInCandidate,
  type CheckInInput,
  type CheckInResult,
  type ManualAttendanceInput,
  type SubscriptionEvaluation,
} from '@gymflow/shared';
import { audit } from '../../lib/audit';
import { assertNotArchived, badRequest, conflict, notFound } from '../../lib/errors';
import type { GymContext } from '../../lib/gym';
import { evaluate, memberRefSelect, toAttendanceDTO, toMemberRef } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { normalizeSearch, pageMeta } from '../../lib/utils';

type Actor = { id: string; name: string; ip: string | null };

const memberInclude = { currentSubscription: { include: { plan: { select: { id: true, name: true, durationDays: true } } } } } as const;
const attendanceInclude = { member: { select: memberRefSelect }, registeredBy: { select: { id: true, name: true } } } as const;

/** Procura membros por código, telefone ou nome (para o check-in rápido). */
export async function findCandidates(ctx: GymContext, term: string, limit = 8): Promise<CheckInCandidate[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const digits = t.replace(/\D/g, '');
  const members = await prisma.member.findMany({ where: { gymId: ctx.gym.id, archivedAt: null }, include: memberInclude });
  const n = normalizeSearch(t);
  return members
    .filter(
      (m) =>
        m.code.toLowerCase() === n ||
        m.code.toLowerCase().endsWith(n) ||
        normalizeSearch(m.fullName).includes(n) ||
        (digits.length >= 4 && m.phone.includes(digits)),
    )
    .slice(0, limit)
    .map((m) => ({ ...toMemberRef(m), status: m.currentSubscription ? evaluate(m.currentSubscription, ctx).status : null }));
}

async function resolveMember(ctx: GymContext, input: CheckInInput) {
  if (input.memberId) {
    return prisma.member.findFirst({ where: { id: input.memberId, gymId: ctx.gym.id }, include: memberInclude });
  }
  if (input.qrToken) {
    const token = input.qrToken.trim().replace(/^GF1:/, '');
    return prisma.member.findFirst({ where: { qrToken: token, gymId: ctx.gym.id }, include: memberInclude });
  }
  const q = input.query!.trim();
  if (q.startsWith('GF1:')) {
    return prisma.member.findFirst({ where: { qrToken: q.slice(4), gymId: ctx.gym.id }, include: memberInclude });
  }
  const byCode = await prisma.member.findFirst({ where: { gymId: ctx.gym.id, code: q.toUpperCase() }, include: memberInclude });
  if (byCode) return byCode;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 9) {
    const byPhone = await prisma.member.findFirst({ where: { gymId: ctx.gym.id, phone: normalizePhone(digits) }, include: memberInclude });
    if (byPhone) return byPhone;
  }
  const matches = await findCandidates(ctx, q, 5);
  if (matches.length > 1) throw conflict('Foram encontrados vários membros. Seleccione o membro na lista.');
  if (matches.length === 1) return prisma.member.findFirst({ where: { id: matches[0].id }, include: memberInclude });
  return null;
}

function accessMessage(e: SubscriptionEvaluation | null): string {
  if (!e) return 'Sem subscrição. Associe um plano ao membro.';
  switch (e.status) {
    case 'EXPIRED':
      return 'Subscrição expirada. Renovação necessária.';
    case 'OVERDUE':
      return `Pagamento em atraso há ${e.daysOverdue} dia(s). Regularize para entrar.`;
    case 'SUSPENDED':
      return 'Subscrição suspensa.';
    case 'CANCELLED':
      return 'Subscrição cancelada.';
    default:
      if (!e.paid) return 'Pagamento pendente. Registe o pagamento para permitir a entrada.';
      if (e.daysUntilDue === 0) return 'Entrada registada. Atenção: a subscrição vence hoje.';
      if (e.status === 'DUE_SOON') return `Entrada registada. A subscrição vence em ${e.daysUntilDue} dia(s).`;
      return 'Entrada registada. Bom treino!';
  }
}

/** Scan QR / código / telefone → verificar subscrição → registar presença. */
export async function checkIn(ctx: GymContext, input: CheckInInput & { method: AttendanceMethod; force: boolean }, actor: Actor): Promise<CheckInResult> {
  const member = await resolveMember(ctx, input);
  if (!member) throw notFound('Membro não encontrado. Verifique o código, telefone ou QR Code.');
  assertNotArchived(member);
  if (!member.active) throw badRequest(`O membro ${member.code} está inactivo.`);

  const sub = member.currentSubscription;
  const e = sub ? evaluate(sub, ctx) : null;
  const allowed = Boolean(e?.accessAllowed);
  const memberInfo = { ...toMemberRef(member), planName: sub?.plan.name ?? null, endDate: sub?.endDate ?? null };

  const open = await prisma.attendance.findFirst({
    where: { memberId: member.id, date: ctx.today, checkOutAt: null },
    include: attendanceInclude,
  });
  if (open) {
    return { allowed: true, attendance: toAttendanceDTO(open), member: memberInfo, status: e?.status ?? null, message: 'O membro já tem entrada registada hoje.', alreadyCheckedIn: true };
  }

  if (!allowed && !input.force) {
    return { allowed: false, attendance: null, member: memberInfo, status: e?.status ?? null, message: accessMessage(e), alreadyCheckedIn: false };
  }

  const attendance = await prisma.attendance.create({
    data: {
      gymId: ctx.gym.id,
      memberId: member.id,
      date: ctx.today,
      checkInAt: new Date(),
      method: input.method,
      subscriptionStatus: e?.status ?? null,
      overridden: !allowed,
      registeredById: actor.id,
    },
    include: attendanceInclude,
  });

  if (!allowed) {
    await audit({
      gymId: ctx.gym.id,
      userId: actor.id,
      action: 'attendance.override',
      entity: 'Attendance',
      entityId: attendance.id,
      summary: `${actor.name} autorizou a entrada de ${member.code} com subscrição ${e?.status ?? 'inexistente'}.`,
      ip: actor.ip,
    });
  }

  return {
    allowed: true,
    attendance: toAttendanceDTO(attendance),
    member: memberInfo,
    status: e?.status ?? null,
    message: allowed ? accessMessage(e) : 'Entrada autorizada manualmente.',
    alreadyCheckedIn: false,
  };
}

export async function checkOut(ctx: GymContext, id: string) {
  const a = await prisma.attendance.findFirst({ where: { id, gymId: ctx.gym.id } });
  if (!a) throw notFound('Presença não encontrada');
  if (a.checkOutAt) throw badRequest('A saída já foi registada');
  const updated = await prisma.attendance.update({ where: { id }, data: { checkOutAt: new Date() }, include: attendanceInclude });
  return toAttendanceDTO(updated);
}

export async function createManualAttendance(ctx: GymContext, input: ManualAttendanceInput, actor: Actor) {
  const member = await prisma.member.findFirst({ where: { id: input.memberId, gymId: ctx.gym.id }, include: memberInclude });
  if (!member) throw notFound('Membro não encontrado');
  assertNotArchived(member);
  if (input.date > ctx.today) throw badRequest('Não é possível registar presenças futuras');
  const checkInAt = zonedDateTimeToInstant(input.date, input.checkInTime, ctx.gym.timezone);
  const checkOutAt = input.checkOutTime ? zonedDateTimeToInstant(input.date, input.checkOutTime, ctx.gym.timezone) : null;
  if (checkOutAt && checkOutAt <= checkInAt) throw badRequest('A hora de saída deve ser posterior à de entrada');

  const attendance = await prisma.attendance.create({
    data: {
      gymId: ctx.gym.id,
      memberId: member.id,
      date: input.date,
      checkInAt,
      checkOutAt,
      method: 'MANUAL',
      subscriptionStatus: member.currentSubscription ? evaluate(member.currentSubscription, ctx).status : null,
      notes: input.notes || null,
      registeredById: actor.id,
    },
    include: attendanceInclude,
  });
  await audit({
    gymId: ctx.gym.id,
    userId: actor.id,
    action: 'attendance.manual',
    entity: 'Attendance',
    entityId: attendance.id,
    summary: `${actor.name} registou manualmente a presença de ${member.code} em ${input.date} ${input.checkInTime}.`,
    ip: actor.ip,
  });
  return toAttendanceDTO(attendance);
}

export async function listAttendance(ctx: GymContext, query: AttendanceListQuery & { page: number; pageSize: number }) {
  const where: Prisma.AttendanceWhereInput = {
    gymId: ctx.gym.id,
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(query.from || query.to ? { date: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    ...(query.q ? { member: { OR: [{ fullName: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q.toUpperCase(), mode: 'insensitive' } }] } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({ where, include: attendanceInclude, orderBy: { checkInAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
  ]);
  return { items: items.map(toAttendanceDTO), ...pageMeta(total, query.page, query.pageSize) };
}
