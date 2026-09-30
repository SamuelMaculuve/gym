import type { NotificationProvider, OutgoingMessage, SendResult } from '../types';

interface MetaConfig {
  apiUrl: string;
  accessToken?: string;
  phoneNumberId?: string;
}

/**
 * WhatsApp Cloud API (Meta). Nota: fora da janela de 24h de conversa, a Meta exige
 * templates aprovados — ver README ("WhatsApp em produção").
 */
export class MetaWhatsAppProvider implements NotificationProvider {
  readonly name = 'meta';
  readonly channel = 'WHATSAPP' as const;
  constructor(private readonly config: MetaConfig) {}

  get configured() {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.configured) throw new Error('WhatsApp não configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
    const res = await fetch(`${this.config.apiUrl.replace(/\/$/, '')}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.to,
        type: 'text',
        text: { preview_url: true, body: message.text },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `WhatsApp API respondeu ${res.status}`);
    return { providerMessageId: data.messages?.[0]?.id };
  }
}
