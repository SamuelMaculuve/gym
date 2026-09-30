import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_TEMPLATES,
  defaultTemplate,
  notificationListQuery,
  sendNotificationSchema,
  templateUpdateSchema,
  type NotificationChannel,
  type NotificationType,
  type TemplateDTO,
} from '@gymflow/shared';
import type { NotificationTemplate } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/errors';
import { getGymContext } from '../../lib/gym';
import { memberRefSelect, toNotificationDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { pageMeta } from '../../lib/utils';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { runReminders } from '../../jobs/reminders';
import { notificationService } from '../../services/notifications/notification-service';

export const notificationsRouter = Router();

const toTemplateDTO = (t: NotificationTemplate): TemplateDTO => ({
  id: t.id,
  type: t.type as NotificationType,
  channel: t.channel as NotificationChannel,
  subject: t.subject,
  body: t.body,
  active: t.active,
  updatedAt: t.updatedAt.toISOString(),
});

/** Garante que todos os templates padrão existem para o ginásio. */
export async function ensureTemplates(gymId: string) {
  const existing = await prisma.notificationTemplate.findMany({ where: { gymId }, select: { type: true, channel: true } });
  const have = new Set(existing.map((t) => `${t.type}:${t.channel}`));
  const missing = DEFAULT_TEMPLATES.filter((t) => t.type !== 'PASSWORD_RESET' && !have.has(`${t.type}:${t.channel}`));
  if (missing.length) {
    await prisma.notificationTemplate.createMany({ data: missing.map((t) => ({ gymId, type: t.type, channel: t.channel, subject: t.subject, body: t.body })) });
  }
}

notificationsRouter.get('/', requirePermission('notifications:read'), async (req, res) => {
  const { gymId } = currentUser(req);
  const q = query(req, notificationListQuery);
  const where: Prisma.NotificationWhereInput = {
    gymId,
    ...(q.channel ? { channel: q.channel } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.memberId ? { memberId: q.memberId } : {}),
    ...(q.q ? { OR: [{ recipient: { contains: q.q } }, { member: { fullName: { contains: q.q } } }, { message: { contains: q.q } }] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: { member: { select: memberRefSelect } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({ items: items.map(toNotificationDTO), ...pageMeta(total, q.page, q.pageSize) });
});

/** Envio manual a um membro (template do tipo escolhido ou mensagem personalizada). */
notificationsRouter.post('/send', requirePermission('notifications:write', 'members:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, sendNotificationSchema);
  const ctx = await getGymContext(user.gymId);
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, gymId: user.gymId },
    include: { currentSubscription: { include: { plan: true } } },
  });
  if (!member) throw notFound('Membro não encontrado');
  if (input.type === 'CUSTOM' && !input.message) throw badRequest('Escreva a mensagem');

  const results = await notificationService.notifyMember({
    ctx,
    member,
    subscription: member.currentSubscription,
    type: input.type,
    channels: input.channels,
    customSubject: input.subject,
    customMessage: input.message || null,
    triggeredBy: user.id,
    ignoreMemberPreference: true,
  });
  const ids = results.map((r) => r.notificationId).filter(Boolean) as string[];
  const rows = await prisma.notification.findMany({ where: { id: { in: ids } }, include: { member: { select: memberRefSelect } } });
  res.json(rows.map(toNotificationDTO));
});

notificationsRouter.post('/run-reminders', requirePermission('notifications:write'), async (req, res) => {
  const user = currentUser(req);
  const { dryRun } = body(req, z.object({ dryRun: z.boolean().default(true) }));
  const result = await runReminders({ gymId: user.gymId, dryRun, force: true, triggeredBy: user.id });
  if (!dryRun && result.sent + result.failed > 0) {
    await audit({
      gymId: user.gymId,
      userId: user.id,
      action: 'notifications.run',
      entity: 'Notification',
      summary: `${user.name} executou os lembretes manualmente: ${result.sent} enviados, ${result.failed} falhados.`,
      ip: req.ip,
    });
  }
  res.json(result);
});

notificationsRouter.get('/templates', requirePermission('notifications:read'), async (req, res) => {
  const { gymId } = currentUser(req);
  await ensureTemplates(gymId);
  const templates = await prisma.notificationTemplate.findMany({ where: { gymId }, orderBy: [{ type: 'asc' }, { channel: 'asc' }] });
  res.json(templates.map(toTemplateDTO));
});

notificationsRouter.put('/templates/:id', requirePermission('notifications:write'), async (req, res) => {
  const actor = actorOf(req);
  const { gymId } = currentUser(req);
  const input = body(req, templateUpdateSchema);
  const existing = await prisma.notificationTemplate.findFirst({ where: { id: param(req, 'id'), gymId } });
  if (!existing) throw notFound('Template não encontrado');
  const updated = await prisma.notificationTemplate.update({
    where: { id: existing.id },
    data: { subject: existing.channel === 'EMAIL' ? (input.subject ?? existing.subject) : null, body: input.body, active: input.active },
  });
  await audit({
    gymId,
    userId: actor.id,
    action: 'template.update',
    entity: 'NotificationTemplate',
    entityId: existing.id,
    summary: `${actor.name} alterou o template ${existing.type} (${existing.channel}).`,
    before: { subject: existing.subject, body: existing.body, active: existing.active },
    after: { subject: updated.subject, body: updated.body, active: updated.active },
    ip: actor.ip,
  });
  res.json(toTemplateDTO(updated));
});

notificationsRouter.post('/templates/:id/reset', requirePermission('notifications:write'), async (req, res) => {
  const { gymId } = currentUser(req);
  const existing = await prisma.notificationTemplate.findFirst({ where: { id: param(req, 'id'), gymId } });
  if (!existing) throw notFound('Template não encontrado');
  const def = defaultTemplate(existing.type as NotificationType, existing.channel as NotificationChannel);
  if (!def) throw notFound('Template padrão não encontrado');
  const updated = await prisma.notificationTemplate.update({ where: { id: existing.id }, data: { subject: def.subject, body: def.body, active: true } });
  res.json(toTemplateDTO(updated));
});
