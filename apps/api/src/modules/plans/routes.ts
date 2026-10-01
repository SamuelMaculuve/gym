import { Router } from 'express';
import type { Plan } from '@prisma/client';
import { formatMoney, planSchema, toCents, type PlanDTO } from '@gymflow/shared';
import { audit, diff } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { getGymContext } from '../../lib/gym';
import { prisma } from '../../lib/prisma';
import { emptyToNull } from '../../lib/utils';
import { currentUser, requirePermission } from '../../middleware/auth';
import { body, param } from '../../middleware/validate';

export const plansRouter = Router();

function toPlanDTO(p: Plan, activeSubscriptions = 0): PlanDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    durationDays: p.durationDays,
    durationLabel: p.durationLabel,
    active: p.active,
    activeSubscriptions,
    createdAt: p.createdAt.toISOString(),
  };
}

plansRouter.get('/', requirePermission('plans:read', 'members:write', 'payments:write'), async (req, res) => {
  const { gymId } = currentUser(req);
  const includeInactive = req.query.includeInactive !== 'false';
  const [plans, counts] = await Promise.all([
    prisma.plan.findMany({ where: { gymId, ...(includeInactive ? {} : { active: true }) }, orderBy: [{ active: 'desc' }, { durationDays: 'asc' }] }),
    prisma.member.groupBy({
      by: ['currentSubscriptionId'],
      where: { gymId, archivedAt: null, currentSubscriptionId: { not: null } },
      _count: true,
    }),
  ]);
  const subs = await prisma.subscription.findMany({
    where: { id: { in: counts.map((c) => c.currentSubscriptionId!) }, state: { not: 'CANCELLED' } },
    select: { planId: true },
  });
  const byPlan = subs.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.planId]: (acc[s.planId] ?? 0) + 1 }), {});
  res.json(plans.map((p) => toPlanDTO(p, byPlan[p.id] ?? 0)));
});

plansRouter.post('/', requirePermission('plans:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, planSchema);
  const plan = await prisma.plan.create({
    data: {
      gymId: user.gymId,
      name: input.name,
      description: emptyToNull(input.description),
      priceCents: toCents(input.price),
      durationDays: input.durationDays,
      durationLabel: emptyToNull(input.durationLabel),
      active: input.active,
    },
  });
  const ctx = await getGymContext(user.gymId);
  await audit({
    gymId: user.gymId,
    userId: user.id,
    action: 'plan.create',
    entity: 'Plan',
    entityId: plan.id,
    summary: `${user.name} criou o plano ${plan.name} (${plan.durationDays} dias — ${formatMoney(plan.priceCents, ctx.gym.currency)}).`,
    after: plan,
    ip: req.ip,
  });
  res.status(201).json(toPlanDTO(plan));
});

plansRouter.patch('/:id', requirePermission('plans:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, planSchema.partial());
  const existing = await prisma.plan.findFirst({ where: { id: param(req, 'id'), gymId: user.gymId } });
  if (!existing) throw notFound('Plano não encontrado');

  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
    ...(input.price !== undefined ? { priceCents: toCents(input.price) } : {}),
    ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
    ...(input.durationLabel !== undefined ? { durationLabel: emptyToNull(input.durationLabel) } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
  const changes = diff(existing as unknown as Record<string, unknown>, data);
  const plan = await prisma.plan.update({ where: { id: existing.id }, data });

  if (changes.changed.length) {
    const ctx = await getGymContext(user.gymId);
    const summary =
      changes.changed.includes('priceCents')
        ? `${user.name} alterou o plano ${existing.name} de ${formatMoney(existing.priceCents, ctx.gym.currency)} para ${formatMoney(plan.priceCents, ctx.gym.currency)}.`
        : `${user.name} actualizou o plano ${existing.name}.`;
    await audit({ gymId: user.gymId, userId: user.id, action: 'plan.update', entity: 'Plan', entityId: plan.id, summary, before: changes.before, after: changes.after, ip: req.ip });
  }
  // Alterações de preço aplicam-se apenas a novos períodos; os existentes mantêm o valor acordado.
  res.json(toPlanDTO(plan));
});
