import { Router } from 'express';
import { paymentCancelSchema, paymentCreateSchema, paymentListQuery, toCents } from '@gymflow/shared';
import { getGymContext } from '../../lib/gym';
import { toPaymentDTO, toSubscriptionDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { notificationService } from '../../services/notifications/notification-service';
import { cancelPayment, getPayment, listPayments, registerPayment } from './service';

export const paymentsRouter = Router();

paymentsRouter.get('/', requirePermission('payments:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await listPayments(ctx, query(req, paymentListQuery)));
});

paymentsRouter.get('/:id', requirePermission('payments:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await getPayment(ctx, param(req, 'id')));
});

paymentsRouter.post('/', requirePermission('payments:write'), async (req, res) => {
  const actor = actorOf(req);
  const ctx = await getGymContext(currentUser(req).gymId);
  const input = body(req, paymentCreateSchema);

  const result = await prisma.$transaction((tx) =>
    registerPayment(tx, ctx, {
      memberId: input.memberId,
      planId: input.planId,
      amountCents: toCents(input.amount),
      paymentDate: input.paymentDate,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      actor,
    }),
  );

  let notificationsQueued = 0;
  if (input.sendConfirmation && ctx.reminders.sendPaymentConfirmation && result.fullyPaid && result.member.notificationsEnabled) {
    notificationsQueued = notificationService
      .enabledChannels(ctx)
      .filter((c) => (c === 'EMAIL' ? Boolean(result.member.email) : true)).length;
    void notificationService
      .notifyMember({
        ctx,
        member: result.member,
        subscription: result.subscription,
        type: result.isRenewal ? 'RENEWAL' : 'PAYMENT_CONFIRMATION',
        triggeredBy: actor.id,
      })
      .catch((e) => console.error('Falha ao enviar confirmação de pagamento', e));
  }

  res.status(201).json({
    payment: toPaymentDTO(result.payment),
    subscription: toSubscriptionDTO(result.subscription, ctx, input.paymentDate),
    notificationsQueued,
  });
});

paymentsRouter.post('/:id/cancel', requirePermission('payments:cancel'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await cancelPayment(ctx, param(req, 'id'), body(req, paymentCancelSchema), actorOf(req)));
});
