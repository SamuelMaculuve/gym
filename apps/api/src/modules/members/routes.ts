import { Router } from 'express';
import { memberCreateSchema, memberListQuery, memberUpdateSchema } from '@gymflow/shared';
import { getGymContext } from '../../lib/gym';
import { toMemberDTO, toPaymentDTO, toSubscriptionDTO } from '../../lib/mappers';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { notificationService } from '../../services/notifications/notification-service';
import { createMember, getMemberDetail, getMemberQr, listMembers, setMemberArchived, updateMember } from './service';

export const membersRouter = Router();

membersRouter.get('/', requirePermission('members:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await listMembers(ctx, query(req, memberListQuery)));
});

membersRouter.post('/', requirePermission('members:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  const input = body(req, memberCreateSchema);
  const result = await createMember(ctx, input, actorOf(req));

  // Notificações fora da transacção: uma falha no envio nunca impede o cadastro.
  const subForNotify = result.subscription
    ? { ...result.subscription, plan: { ...result.subscription.plan } }
    : null;
  if (input.sendWelcome && ctx.reminders.sendWelcome) {
    void notificationService
      .notifyMember({ ctx, member: result.member, subscription: subForNotify, type: 'WELCOME', triggeredBy: currentUser(req).id })
      .catch((e) => console.error('Falha ao enviar boas-vindas', e));
  }

  res.status(201).json({
    member: toMemberDTO(result.member),
    subscription: result.subscription ? toSubscriptionDTO(result.subscription, ctx) : null,
    payment: result.payment ? toPaymentDTO(result.payment) : null,
  });
});

membersRouter.get('/:id', requirePermission('members:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await getMemberDetail(ctx, param(req, 'id')));
});

membersRouter.patch('/:id', requirePermission('members:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await updateMember(ctx, param(req, 'id'), body(req, memberUpdateSchema), actorOf(req)));
});

membersRouter.post('/:id/archive', requirePermission('members:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await setMemberArchived(ctx, param(req, 'id'), true, actorOf(req)));
});

membersRouter.post('/:id/restore', requirePermission('members:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await setMemberArchived(ctx, param(req, 'id'), false, actorOf(req)));
});

membersRouter.get('/:id/qr', requirePermission('members:read', 'attendance:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await getMemberQr(ctx, param(req, 'id'), false));
});

membersRouter.post('/:id/qr/regenerate', requirePermission('members:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await getMemberQr(ctx, param(req, 'id'), true, actorOf(req)));
});
