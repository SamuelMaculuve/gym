import { Router } from 'express';
import {
  addDays,
  eachDay,
  monthKey,
  PAYMENT_METHODS,
  reportQuery,
  startOfWeek,
  SUBSCRIPTION_STATUSES,
  toLocalTime,
  type AttendanceReport,
  type FinancialReport,
  type MembersReport,
} from '@gymflow/shared';
import { badRequest } from '../../lib/errors';
import { getGymContext } from '../../lib/gym';
import { memberRefSelect, paymentInclude, toMemberRef, toPaymentDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { currentUser, requirePermission } from '../../middleware/auth';
import { query } from '../../middleware/validate';
import { loadMembersWithStatus } from '../members/service';

export const reportsRouter = Router();

type GroupBy = 'day' | 'week' | 'month' | 'year';

function periodKey(date: string, groupBy: GroupBy) {
  if (groupBy === 'day') return date;
  if (groupBy === 'week') return startOfWeek(date);
  if (groupBy === 'month') return monthKey(date);
  return date.slice(0, 4);
}

function periodKeys(from: string, to: string, groupBy: GroupBy) {
  const keys = new Set<string>();
  for (const d of eachDay(from, to)) keys.add(periodKey(d, groupBy));
  return [...keys];
}

function parseRange(req: Parameters<typeof query>[0]) {
  const q = query(req, reportQuery);
  if (q.from > q.to) throw badRequest('A data inicial deve ser anterior à final');
  if (addDays(q.from, 366 * 5) < q.to) throw badRequest('Período máximo: 5 anos');
  return q;
}

reportsRouter.get('/financial', requirePermission('reports:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const { from, to, groupBy } = parseRange(req);
  const [payments, refunded] = await Promise.all([
    prisma.payment.findMany({
      where: { gymId: ctx.gym.id, status: 'PAID', paymentDate: { gte: from, lte: to } },
      include: paymentInclude,
      orderBy: { paymentDate: 'asc' },
    }),
    prisma.payment.aggregate({
      where: { gymId: ctx.gym.id, status: { in: ['REFUNDED', 'CANCELLED'] }, paymentDate: { gte: from, lte: to } },
      _sum: { amountCents: true },
    }),
  ]);

  const series = periodKeys(from, to, groupBy).map((period) => {
    const list = payments.filter((p) => periodKey(p.paymentDate, groupBy) === period);
    return { period, totalCents: list.reduce((s, p) => s + p.amountCents, 0), count: list.length };
  });

  const byPlanMap = new Map<string, { totalCents: number; count: number }>();
  for (const p of payments) {
    const name = p.subscription?.plan.name ?? 'Sem plano';
    const cur = byPlanMap.get(name) ?? { totalCents: 0, count: 0 };
    byPlanMap.set(name, { totalCents: cur.totalCents + p.amountCents, count: cur.count + 1 });
  }

  const report: FinancialReport = {
    from,
    to,
    groupBy,
    currency: ctx.gym.currency,
    totalCents: payments.reduce((s, p) => s + p.amountCents, 0),
    count: payments.length,
    refundedCents: refunded._sum.amountCents ?? 0,
    series,
    byPlan: [...byPlanMap.entries()].map(([planName, v]) => ({ planName, ...v })).sort((a, b) => b.totalCents - a.totalCents),
    byMethod: PAYMENT_METHODS.map((method) => {
      const list = payments.filter((p) => p.method === method);
      return { method, totalCents: list.reduce((s, p) => s + p.amountCents, 0), count: list.length };
    }).filter((m) => m.count > 0),
    payments: payments.slice(-5000).reverse().map(toPaymentDTO),
  };
  res.json(report);
});

reportsRouter.get('/members', requirePermission('reports:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const { from, to } = parseRange(req);
  const all = await loadMembersWithStatus(ctx);
  const items = all.map((a) => a.item);
  const report: MembersReport = {
    from,
    to,
    newMembers: items
      .filter((m) => m.joinedAt >= from && m.joinedAt <= to)
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .map((m) => ({ id: m.id, code: m.code, fullName: m.fullName, phone: m.phone, joinedAt: m.joinedAt, planName: m.planName })),
    byStatus: [
      ...SUBSCRIPTION_STATUSES.map((status) => ({ status, count: items.filter((m) => m.status === status).length })),
      { status: 'NONE' as const, count: items.filter((m) => m.status === null).length },
    ],
    members: items.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt')),
  };
  res.json(report);
});

reportsRouter.get('/attendance', requirePermission('reports:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const { from, to } = parseRange(req);
  const rows = await prisma.attendance.findMany({
    where: { gymId: ctx.gym.id, date: { gte: from, lte: to } },
    select: { date: true, checkInAt: true, memberId: true, member: { select: memberRefSelect } },
  });

  const byMember = new Map<string, { ref: ReturnType<typeof toMemberRef>; visits: number; lastVisit: string }>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const r of rows) {
    const cur = byMember.get(r.memberId) ?? { ref: toMemberRef(r.member), visits: 0, lastVisit: r.date };
    byMember.set(r.memberId, { ref: cur.ref, visits: cur.visits + 1, lastVisit: r.date > cur.lastVisit ? r.date : cur.lastVisit });
    byHour[Number(toLocalTime(r.checkInAt, ctx.gym.timezone).slice(0, 2))].count++;
  }

  const report: AttendanceReport = {
    from,
    to,
    total: rows.length,
    byDay: eachDay(from, to).map((date) => ({ date, count: rows.filter((r) => r.date === date).length })),
    byMember: [...byMember.values()].map((v) => ({ ...v.ref, visits: v.visits, lastVisit: v.lastVisit })).sort((a, b) => b.visits - a.visits),
    byHour,
  };
  res.json(report);
});
