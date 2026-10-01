import { Router } from 'express';
import { subscriptionActionSchema, subscriptionCreateSchema, subscriptionListQuery, subscriptionRemindersSchema } from '@gymflow/shared';
import { audit } from '../../lib/audit';
import { assertNotArchived, notFound } from '../../lib/errors';
import { getGymContext } from '../../lib/gym';
import { toSubscriptionDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { changeSubscriptionState, createSubscriptionPeriod, listSubscriptions, setRemindersPaused } from './service';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', requirePermission('subscriptions:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await listSubscriptions(ctx, query(req, subscriptionListQuery)));
});

/** Cria um novo período (ex.: mudança de plano) sem pagamento associado. */
subscriptionsRouter.post('/', requirePermission('subscriptions:write'), async (req, res) => {
  const actor = actorOf(req);
  const ctx = await getGymContext(currentUser(req).gymId);
  const input = body(req, subscriptionCreateSchema);
  const [member, plan] = await Promise.all([
    prisma.member.findFirst({ where: { id: input.memberId, gymId: ctx.gym.id } }),
    prisma.plan.findFirst({ where: { id: input.planId, gymId: ctx.gym.id } }),
  ]);
  if (!member) throw notFound('Membro não encontrado');
  assertNotArchived(member);
  if (!plan) throw notFound('Plano não encontrado');

  const sub = await prisma.$transaction(async (tx) => {
    const created = await createSubscriptionPeriod(tx, { gymId: ctx.gym.id, memberId: member.id, plan, startDate: input.startDate, endDate: input.endDate || null });
    await audit(
      {
        gymId: ctx.gym.id,
        userId: actor.id,
        action: 'subscription.create',
        entity: 'Subscription',
        entityId: created.id,
        summary: `${actor.name} associou o plano ${plan.name} a ${member.code} (${created.startDate} → ${created.endDate}).`,
        after: { planId: plan.id, startDate: created.startDate, endDate: created.endDate, amountCents: created.amountCents },
        ip: actor.ip,
      },
      tx,
    );
    return created;
  });
  res.status(201).json(toSubscriptionDTO(sub, ctx));
});

for (const action of ['suspend', 'resume', 'cancel'] as const) {
  subscriptionsRouter.post(`/:id/${action}`, requirePermission('subscriptions:write'), async (req, res) => {
    const ctx = await getGymContext(currentUser(req).gymId);
    const { reason } = body(req, subscriptionActionSchema);
    res.json(await changeSubscriptionState(ctx, param(req, 'id'), action, actorOf(req), reason));
  });
}

subscriptionsRouter.patch('/:id/reminders', requirePermission('subscriptions:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const { remindersPaused } = body(req, subscriptionRemindersSchema);
  res.json(await setRemindersPaused(ctx, param(req, 'id'), remindersPaused, actorOf(req)));
});
