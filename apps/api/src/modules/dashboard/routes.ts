import { Router } from 'express';
import {
  addDays,
  addMonths,
  monthKey,
  startOfMonth,
  startOfWeek,
  SUBSCRIPTION_STATUSES,
  type DashboardSummary,
} from '@gymflow/shared';
import { getGymContext } from '../../lib/gym';
import { paymentInclude, toMemberRef, toPaymentDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { currentUser, requirePermission } from '../../middleware/auth';
import { loadMembersWithStatus } from '../members/service';

export const dashboardRouter = Router();

dashboardRouter.get('/', requirePermission('dashboard:view'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const { today } = ctx;
  const monthStart = startOfMonth(today);
  const prevMonthStart = addMonths(monthStart, -1);
  const twelveMonthsAgo = addMonths(monthStart, -11);
  const weekStart = startOfWeek(today);

  const [members, payments, attendanceToday, attendanceWeek, recentAttendance, recentPayments] = await Promise.all([
    loadMembersWithStatus(ctx),
    prisma.payment.findMany({
      where: { gymId: ctx.gym.id, status: 'PAID', paymentDate: { gte: twelveMonthsAgo, lte: today } },
      select: { amountCents: true, paymentDate: true },
    }),
    prisma.attendance.count({ where: { gymId: ctx.gym.id, date: today } }),
    prisma.attendance.count({ where: { gymId: ctx.gym.id, date: { gte: weekStart, lte: today } } }),
    prisma.attendance.groupBy({
      by: ['memberId'],
      where: { gymId: ctx.gym.id, date: { gte: addDays(today, -29) } },
      _count: true,
      _max: { date: true },
    }),
    prisma.payment.findMany({ where: { gymId: ctx.gym.id }, include: paymentInclude, orderBy: { createdAt: 'desc' }, take: 6 }),
  ]);

  const items = members.map((m) => m.item);
  const count = (fn: (i: (typeof items)[number]) => boolean) => items.filter(fn).length;

  // Receita por mês (últimos 12)
  const months = Array.from({ length: 12 }, (_, i) => monthKey(addMonths(twelveMonthsAgo, i)));
  const revenueByMonth = months.map((month) => {
    const list = payments.filter((p) => monthKey(p.paymentDate) === month);
    return { month, totalCents: list.reduce((s, p) => s + p.amountCents, 0), count: list.length };
  });
  const thisMonth = revenueByMonth[11];
  const prevMonth = revenueByMonth.find((r) => r.month === monthKey(prevMonthStart))!;

  // Presenças
  const memberById = new Map(members.map((m) => [m.member.id, m.member]));
  const topAttendees = recentAttendance
    .sort((a, b) => b._count - a._count)
    .flatMap((a) => {
      const m = memberById.get(a.memberId); // ausente = arquivado
      return m ? [{ ...toMemberRef(m), visits: a._count }] : [];
    })
    .slice(0, 5);

  const lastVisits = await prisma.attendance.groupBy({ by: ['memberId'], where: { gymId: ctx.gym.id }, _max: { date: true } });
  const lastVisitBy = new Map(lastVisits.map((v) => [v.memberId, v._max.date]));
  const inactiveAttendees = members
    .filter((m) => m.item.isActive)
    .map((m) => {
      const last = lastVisitBy.get(m.member.id) ?? null;
      const days = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000) : null;
      return { ...toMemberRef(m.member), lastVisit: last, days };
    })
    .filter((m) => m.days === null || m.days >= 7)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
    .slice(0, 6);

  const summary: DashboardSummary = {
    today,
    currency: ctx.gym.currency,
    totals: {
      members: items.length,
      activeMembers: count((i) => i.isActive),
      inactiveMembers: count((i) => !i.isActive),
      dueToday: count((i) => i.status === 'DUE_SOON' && i.dueDate === today),
      dueNext7Days: count((i) => i.status === 'DUE_SOON' && i.dueDate !== today),
      overdue: count((i) => i.status === 'OVERDUE'),
      revenueThisMonthCents: thisMonth.totalCents,
      revenuePrevMonthCents: prevMonth.totalCents,
      paymentsThisMonth: thisMonth.count,
      newMembersThisMonth: count((i) => i.joinedAt >= monthStart && i.joinedAt <= today),
      attendanceToday,
      attendanceThisWeek: attendanceWeek,
    },
    revenueByMonth,
    subscriptionStatus: SUBSCRIPTION_STATUSES.map((status) => ({ status, count: count((i) => i.status === status) })),
    paymentStatus: {
      paid: count((i) => i.status === 'ACTIVE'),
      pending: count((i) => i.status === 'DUE_SOON'),
      overdue: count((i) => i.status === 'OVERDUE'),
    },
    topAttendees,
    inactiveAttendees,
    recentPayments: recentPayments.map(toPaymentDTO),
    recentMembers: members
      .map((m) => m.member)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((m) => ({ ...toMemberRef(m), joinedAt: m.joinedAt })),
  };
  res.json(summary);
});
