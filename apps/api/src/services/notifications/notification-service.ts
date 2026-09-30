import { Prisma, type Member, type Plan, type Subscription } from '@prisma/client';
import {
  NOTIFICATION_CHANNELS,
  defaultTemplate,
  normalizePhone,
  formatDate,
  formatMoney,
  renderTemplate,
  type NotificationChannel,
  type NotificationType,
  type TemplateVariables,
} from '@gymflow/shared';
import { env } from '../../config/env';
import type { GymContext } from '../../lib/gym';
import { evaluate } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { getOrCreatePaymentLink } from '../payments/payment-links';
import { renderEmailHtml } from './email-layout';
import { createProviders } from './providers';
import { UnsupportedMessageError, type MessageContext, type NotificationProvider, type OutgoingMessage } from './types';

export interface DeliverInput {
  gymId: string;
  memberId?: string | null;
  subscriptionId?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject?: string | null;
  message: string;
  html?: string;
  context?: MessageContext;
  dedupeKey?: string | null;
  triggeredBy?: string;
}

/** Destinatários autorizados (NOTIFICATIONS_ALLOWLIST); null = todos. */
const allowlist: Set<string> | null = env.NOTIFICATIONS_ALLOWLIST
  ? new Set(
      env.NOTIFICATIONS_ALLOWLIST.split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .map((v) => (v.includes('@') ? v : normalizePhone(v))),
    )
  : null;

function isAllowed(channel: NotificationChannel, recipient: string) {
  if (!allowlist) return true;
  return allowlist.has(channel === 'EMAIL' ? recipient.toLowerCase() : normalizePhone(recipient));
}

export interface NotifyMemberInput {
  ctx: GymContext;
  member: Member;
  subscription?: (Subscription & { plan: Pick<Plan, 'name'> }) | null;
  type: NotificationType;
  /** Por omissão: todos os canais activos nas configurações. */
  channels?: NotificationChannel[];
  customSubject?: string | null;
  customMessage?: string | null;
  /** Função que devolve a chave de deduplicação para cada canal. */
  dedupeKey?: (channel: NotificationChannel) => string;
  triggeredBy?: string;
  /** Ignora a preferência do membro (ex.: envio manual pelo administrador). */
  ignoreMemberPreference?: boolean;
  dryRun?: boolean;
}

export interface NotifyResult {
  channel: NotificationChannel;
  status: 'SENT' | 'FAILED' | 'SKIPPED' | 'DUPLICATE' | 'WOULD_SEND';
  notificationId?: string;
  error?: string;
}

/**
 * Serviço único de notificações. Os componentes React e as rotas nunca falam
 * directamente com o WhatsApp/Email/SMS — tudo passa por aqui.
 */
export class NotificationService {
  constructor(private readonly providers: Record<NotificationChannel, NotificationProvider> = createProviders()) {}

  providerStatus() {
    return Object.fromEntries(
      NOTIFICATION_CHANNELS.map((c) => [c, { provider: this.providers[c].name, configured: this.providers[c].configured }]),
    ) as Record<NotificationChannel, { provider: string; configured: boolean }>;
  }

  // ---- Envio directo (sem histórico) ----

  sendWhatsApp(to: string, text: string) {
    return this.providers.WHATSAPP.send({ to, text });
  }

  sendEmail(to: string, subject: string, text: string, html?: string) {
    return this.providers.EMAIL.send({ to, subject, text, html });
  }

  sendSMS(to: string, text: string) {
    return this.providers.SMS.send({ to, text });
  }

  private sendVia(channel: NotificationChannel, message: OutgoingMessage) {
    // Passa a mensagem completa (inclui o contexto estruturado para fornecedores com templates).
    return this.providers[channel].send(message);
  }

  /**
   * Regista a notificação no histórico e envia-a. Se a `dedupeKey` já existir,
   * não envia nada (protecção contra duplicados, inclusive entre processos).
   */
  async deliver(input: DeliverInput): Promise<NotifyResult> {
    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          gymId: input.gymId,
          memberId: input.memberId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          channel: input.channel,
          type: input.type,
          recipient: input.recipient,
          subject: input.subject ?? null,
          message: input.message,
          status: 'PENDING',
          provider: this.providers[input.channel].name,
          dedupeKey: input.dedupeKey ?? null,
          triggeredBy: input.triggeredBy ?? 'system',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { channel: input.channel, status: 'DUPLICATE' };
      }
      throw err;
    }

    const skip = async (reason: string): Promise<NotifyResult> => {
      await prisma.notification.update({ where: { id: notification.id }, data: { status: 'SKIPPED', error: reason } });
      return { channel: input.channel, status: 'SKIPPED', notificationId: notification.id, error: reason };
    };
    if (!isAllowed(input.channel, input.recipient)) {
      return skip('Destinatário fora da lista de teste (NOTIFICATIONS_ALLOWLIST).');
    }

    try {
      const result = await this.sendVia(input.channel, {
        to: input.recipient,
        subject: input.subject,
        text: input.message,
        html: input.html,
        context: input.context,
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date(), providerMessageId: result.providerMessageId ?? null },
      });
      return { channel: input.channel, status: 'SENT', notificationId: notification.id };
    } catch (err) {
      if (err instanceof UnsupportedMessageError) return skip(err.message);
      const error = err instanceof Error ? err.message.slice(0, 500) : 'Erro desconhecido';
      await prisma.notification.update({ where: { id: notification.id }, data: { status: 'FAILED', error } });
      return { channel: input.channel, status: 'FAILED', notificationId: notification.id, error };
    }
  }

  enabledChannels(ctx: GymContext): NotificationChannel[] {
    const s = ctx.reminders;
    return NOTIFICATION_CHANNELS.filter((c) => (c === 'WHATSAPP' ? s.whatsappEnabled : c === 'EMAIL' ? s.emailEnabled : s.smsEnabled));
  }

  async buildVariables(ctx: GymContext, member: Member, subscription?: NotifyMemberInput['subscription'], dryRun = false): Promise<TemplateVariables> {
    let amount = '';
    let dueDate = '';
    let paymentLink = '';
    if (subscription) {
      const e = evaluate(subscription, ctx);
      const outstanding = e.paid ? subscription.amountCents : subscription.amountCents - subscription.amountPaidCents;
      amount = formatMoney(outstanding, ctx.gym.currency);
      dueDate = formatDate(e.dueDate);
      if (ctx.gym.paymentLinkEnabled && subscription.state === 'NORMAL' && !dryRun) {
        paymentLink = await getOrCreatePaymentLink(subscription);
      }
    }
    return {
      name: member.fullName.split(' ')[0],
      full_name: member.fullName,
      member_code: member.code,
      plan: subscription?.plan.name ?? '',
      amount,
      due_date: dueDate,
      gym_name: ctx.gym.name,
      gym_phone: ctx.gym.phone ?? '',
      payment_link: paymentLink,
    };
  }

  private async loadTemplate(gymId: string, type: NotificationType, channel: NotificationChannel) {
    const tpl = await prisma.notificationTemplate.findUnique({ where: { gymId_type_channel: { gymId, type, channel } } });
    if (tpl) return tpl.active ? tpl : null;
    const def = defaultTemplate(type, channel);
    return def ? { subject: def.subject, body: def.body } : null;
  }

  /** Renderiza os templates e envia a um membro por cada canal disponível. */
  async notifyMember(input: NotifyMemberInput): Promise<NotifyResult[]> {
    const { ctx, member } = input;
    if (!input.ignoreMemberPreference && !member.notificationsEnabled) return [];

    const channels = (input.channels ?? this.enabledChannels(ctx)).filter((c) => (c === 'EMAIL' ? Boolean(member.email) : Boolean(member.phone)));
    if (channels.length === 0) return [];

    const vars = await this.buildVariables(ctx, member, input.subscription, input.dryRun);
    const results: NotifyResult[] = [];

    for (const channel of channels) {
      const tpl = input.customMessage ? { subject: input.customSubject ?? null, body: input.customMessage } : await this.loadTemplate(ctx.gym.id, input.type, channel);
      if (!tpl) {
        results.push({ channel, status: 'SKIPPED' });
        continue;
      }
      const message = renderTemplate(tpl.body, vars).replace(/\n{3,}/g, '\n\n').trim();
      const subject = channel === 'EMAIL' ? renderTemplate(tpl.subject ?? ctx.gym.name, vars) : null;

      if (input.dryRun) {
        results.push({ channel, status: 'WOULD_SEND' });
        continue;
      }

      results.push(
        await this.deliver({
          gymId: ctx.gym.id,
          memberId: member.id,
          subscriptionId: input.subscription?.id ?? null,
          channel,
          type: input.type,
          recipient: channel === 'EMAIL' ? member.email! : member.phone,
          subject,
          message,
          html:
            channel === 'EMAIL'
              ? renderEmailHtml({
                  gymName: ctx.gym.name,
                  logoUrl: ctx.gym.logoUrl,
                  subject: subject ?? ctx.gym.name,
                  text: message,
                  ctaUrl: typeof vars.payment_link === 'string' ? vars.payment_link : null,
                })
              : undefined,
          context: {
            type: input.type,
            memberName: member.fullName,
            memberCode: member.code,
            gymName: ctx.gym.name,
            planName: String(vars.plan ?? ''),
            dueDate: String(vars.due_date ?? ''),
            amount: String(vars.amount ?? ''),
            paymentLink: String(vars.payment_link ?? ''),
          },
          dedupeKey: input.dedupeKey?.(channel) ?? null,
          triggeredBy: input.triggeredBy,
        }),
      );
    }
    return results;
  }
}

export const notificationService = new NotificationService();
