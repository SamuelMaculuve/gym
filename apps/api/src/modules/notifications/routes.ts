import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_TEMPLATES,
  NOTIFICATION_CHANNEL_LABELS,
  broadcastSchema,
  type BroadcastResult,
  defaultTemplate,
  notificationListQuery,
  reminderSendSchema,
  NOTIFICATION_TYPE_LABELS,
  sendNotificationSchema,
  templateUpdateSchema,
  type NotificationChannel,
  type NotificationType,
  type TemplateDTO,
} from '@gymflow/shared';
import type { NotificationTemplate } from '@prisma/client';
import { z } from 'zod';
import { onNetlify } from '../../config/env';
import { audit } from '../../lib/audit';
import { assertNotArchived, badRequest, notFound } from '../../lib/errors';
import { getGymContext, type GymContext } from '../../lib/gym';
import { evaluate, memberRefSelect, toNotificationDTO } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { pageMeta } from '../../lib/utils';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { runReminders } from '../../jobs/reminders';
import { loadMembersWithStatus, matchesMemberFilter, type MemberWithCurrent } from '../members/service';
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
    ...(q.q ? { OR: [{ recipient: { contains: q.q, mode: 'insensitive' } }, { member: { fullName: { contains: q.q, mode: 'insensitive' } } }, { message: { contains: q.q, mode: 'insensitive' } }] } : {}),
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
  assertNotArchived(member);
  if (!member.notificationsEnabled) throw badRequest('As notificações estão desactivadas para este membro. Active-as no perfil para enviar.');
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
  });
  const ids = results.map((r) => r.notificationId).filter(Boolean) as string[];
  const rows = await prisma.notification.findMany({ where: { id: { in: ids } }, include: { member: { select: memberRefSelect } } });
  res.json(rows.map(toNotificationDTO));
});

/**
 * Envio manual e individual de um lembrete. Escolhe o tipo pelo estado da subscrição
 * (auto) ou força "lembrete" / "aviso de atraso". Não usa deduplicação: é uma acção explícita.
 */
notificationsRouter.post('/remind', requirePermission('notifications:write', 'members:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, reminderSendSchema);
  const ctx = await getGymContext(user.gymId);
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, gymId: user.gymId },
    include: { currentSubscription: { include: { plan: true } } },
  });
  if (!member) throw notFound('Membro não encontrado');
  assertNotArchived(member);
  if (!member.notificationsEnabled) throw badRequest('As notificações estão desactivadas para este membro. Active-as no perfil para enviar.');
  const sub = member.currentSubscription;
  if (!sub || sub.state === 'CANCELLED') throw badRequest('O membro não tem uma subscrição activa para lembrar.');

  const e = evaluate(sub, ctx);
  const late = e.daysUntilDue < 0;
  const kind = input.kind === 'auto' ? (late ? 'warning' : 'reminder') : input.kind;
  if (kind === 'warning' && !late) throw badRequest('A subscrição ainda não venceu: envie um lembrete de vencimento em vez de um aviso de atraso.');
  if (kind === 'reminder' && late) throw badRequest('A subscrição já venceu: envie um aviso de pagamento em atraso.');
  const type: NotificationType = kind === 'warning' ? (e.status === 'EXPIRED' ? 'EXPIRED' : 'OVERDUE') : e.daysUntilDue === 0 ? 'DUE_TODAY' : 'DUE_REMINDER';

  const results = await notificationService.notifyMember({ ctx, member, subscription: sub, type, channels: input.channels, triggeredBy: user.id });
  if (results.length === 0) throw badRequest('Nenhum canal disponível: active o WhatsApp/email nas configurações ou adicione um contacto ao membro.');

  const ids = results.map((r) => r.notificationId).filter(Boolean) as string[];
  const rows = await prisma.notification.findMany({ where: { id: { in: ids } }, include: { member: { select: memberRefSelect } } });
  const count = (s: string) => results.filter((r) => r.status === s).length;
  await audit({
    gymId: user.gymId,
    userId: user.id,
    action: 'notifications.remind',
    entity: 'Member',
    entityId: member.id,
    summary: `${user.name} enviou manualmente "${NOTIFICATION_TYPE_LABELS[type]}" a ${member.code} (${count('SENT')} enviada(s), ${count('FAILED')} falhada(s)).`,
    ip: req.ip,
  });
  res.json({ type, notifications: rows.map(toNotificationDTO), sent: count('SENT'), failed: count('FAILED'), skipped: count('SKIPPED') });
});

/** Lembrete adequado ao estado da subscrição (vence em breve / hoje / em atraso / expirada). */
function autoReminderType(sub: MemberWithCurrent['currentSubscription'], ctx: GymContext): NotificationType | null {
  if (!sub || sub.state === 'CANCELLED') return null;
  const e = evaluate(sub, ctx);
  if (e.daysUntilDue < 0) return e.status === 'EXPIRED' ? 'EXPIRED' : 'OVERDUE';
  return e.daysUntilDue === 0 ? 'DUE_TODAY' : 'DUE_REMINDER';
}

/** Limite por envio: cada mensagem é uma chamada ao fornecedor e a função tem tempo limitado. */
const BROADCAST_MAX = 100;

/**
 * Envio em massa. Com `dryRun` só conta os destinatários (pré-visualização).
 * Email: mensagem livre. WhatsApp: lembrete/aviso por template, consoante o estado de cada membro.
 * Respeita a preferência de notificações de cada membro e ignora os arquivados.
 */
notificationsRouter.post('/broadcast', requirePermission('notifications:write', 'members:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, broadcastSchema);
  const label = NOTIFICATION_CHANNEL_LABELS[input.channel];
  if (input.channel === 'SMS') throw badRequest('O envio por SMS estará disponível brevemente.');
  if (input.channel === 'EMAIL' && !input.dryRun && (!input.subject || !input.message)) throw badRequest('Escreva o assunto e a mensagem do email.');

  const ctx = await getGymContext(user.gymId);
  const audience = (await loadMembersWithStatus(ctx)).filter(({ item }) => matchesMemberFilter(item, input.audience, ctx.today));
  const excluded = { noContact: 0, notificationsOff: 0, noSubscription: 0 };
  const targets: { member: MemberWithCurrent; type: NotificationType }[] = [];
  for (const { member } of audience) {
    if (!member.notificationsEnabled) excluded.notificationsOff++;
    else if (input.channel === 'EMAIL' ? !member.email : !member.phone) excluded.noContact++;
    else if (input.channel === 'EMAIL') targets.push({ member, type: 'CUSTOM' });
    else {
      const type = autoReminderType(member.currentSubscription, ctx);
      if (type) targets.push({ member, type });
      else excluded.noSubscription++;
    }
  }

  const status = notificationService.providerStatus()[input.channel];
  const result: BroadcastResult = {
    channel: input.channel,
    audience: input.audience,
    dryRun: input.dryRun,
    total: audience.length,
    recipients: targets.length,
    sample: targets.slice(0, 5).map((t) => t.member.fullName),
    excluded,
    provider: { name: status.provider, configured: status.configured, real: status.provider !== 'console' },
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  if (input.dryRun || targets.length === 0) {
    res.setHeader('X-No-Persist', '1'); // nada mudou: o modo demonstração não precisa de gravar
    return void res.json(result);
  }

  if (!status.configured) throw badRequest(`O ${label} não está configurado. Veja as variáveis do fornecedor nas configurações do site.`);
  // Na Netlify, o fornecedor "console" só escreve no log: as mensagens nunca chegariam.
  if (onNetlify && !result.provider.real) {
    throw badRequest(
      input.channel === 'EMAIL'
        ? 'O email não está configurado. Na Netlify defina EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_USER, SMTP_PASSWORD e EMAIL_FROM (ex.: Gmail com palavra-passe de aplicação, grátis).'
        : `O ${label} não está configurado na Netlify.`,
    );
  }
  if (targets.length > BROADCAST_MAX) throw badRequest(`No máximo ${BROADCAST_MAX} destinatários por envio (seleccionou ${targets.length}). Escolha um público mais restrito.`);

  // Poucos envios em paralelo: rápido sem sobrecarregar o fornecedor.
  for (let i = 0; i < targets.length; i += 4) {
    const batch = await Promise.all(
      targets.slice(i, i + 4).map(({ member, type }) =>
        notificationService.notifyMember({
          ctx,
          member,
          subscription: member.currentSubscription,
          type,
          channels: [input.channel],
          customSubject: input.channel === 'EMAIL' ? input.subject : null,
          customMessage: input.channel === 'EMAIL' ? input.message : null,
          triggeredBy: user.id,
        }),
      ),
    );
    for (const r of batch.flat()) {
      if (r.status === 'SENT') result.sent++;
      else if (r.status === 'FAILED') result.failed++;
      else result.skipped++;
    }
  }

  await audit({
    gymId: user.gymId,
    userId: user.id,
    action: 'notifications.broadcast',
    entity: 'Notification',
    summary: `${user.name} enviou ${input.channel === 'EMAIL' ? `o email "${input.subject}"` : 'lembretes por WhatsApp'} a ${targets.length} membro(s): ${result.sent} enviado(s), ${result.failed} falhado(s), ${result.skipped} ignorado(s).`,
    ip: req.ip,
  });
  res.json(result);
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
