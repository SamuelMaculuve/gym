import type { NotificationType } from '@gymflow/shared';
import { UnsupportedMessageError, type NotificationProvider, type OutgoingMessage, type SendResult } from '../types';

interface WebhookConfig {
  url?: string;
  username?: string;
  password?: string;
}

/** Tipos de notificação do GymFlow → templates disponíveis no webhook. */
export const WEBHOOK_NOTIFICATION_TYPES: Partial<Record<NotificationType, 'gym_reminder' | 'gym_warning'>> = {
  DUE_REMINDER: 'gym_reminder',
  DUE_TODAY: 'gym_reminder',
  OVERDUE: 'gym_warning',
  EXPIRED: 'gym_warning',
};

/**
 * WhatsApp através de um webhook de automação (ex.: n8n), com autenticação Basic.
 * O webhook tem os seus próprios templates: enviamos dados estruturados, não texto livre.
 *
 *   POST WHATSAPP_WEBHOOK_URL
 *   { notification_type, name, phone: "+2588…", gym_name, expire_date: "dd/mm/aaaa" }
 */
export class WebhookWhatsAppProvider implements NotificationProvider {
  readonly name = 'webhook';
  readonly channel = 'WHATSAPP' as const;
  constructor(private readonly config: WebhookConfig) {}

  get configured() {
    return Boolean(this.config.url && this.config.username && this.config.password);
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.configured) throw new Error('Webhook não configurado (WHATSAPP_WEBHOOK_URL / _USERNAME / _PASSWORD)');
    const ctx = message.context;
    const notificationType = ctx && WEBHOOK_NOTIFICATION_TYPES[ctx.type];
    if (!ctx || !notificationType) {
      throw new UnsupportedMessageError('O fornecedor de WhatsApp só suporta lembretes de vencimento e avisos de atraso.');
    }
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    const res = await fetch(this.config.url!, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        notification_type: notificationType,
        name: ctx.memberName,
        phone: `+${message.to.replace(/^\+/, '')}`,
        gym_name: ctx.gymName,
        expire_date: ctx.dueDate,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`Webhook respondeu ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    let id: string | undefined;
    try {
      const data = JSON.parse(text) as { id?: string; messageId?: string; executionId?: string };
      id = data.id ?? data.messageId ?? data.executionId;
    } catch {
      /* resposta sem JSON */
    }
    return { providerMessageId: id ?? `webhook-${Date.now()}` };
  }
}
