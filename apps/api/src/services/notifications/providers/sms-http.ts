import type { NotificationProvider, OutgoingMessage, SendResult } from '../types';

interface HttpSmsConfig {
  apiUrl?: string;
  apiKey?: string;
  senderId?: string;
}

/**
 * Fornecedor SMS genérico via HTTP (JSON). Adapte o corpo do pedido ao seu fornecedor
 * ou crie uma implementação específica.
 */
export class HttpSmsProvider implements NotificationProvider {
  readonly name = 'http';
  readonly channel = 'SMS' as const;
  constructor(private readonly config: HttpSmsConfig) {}

  get configured() {
    return Boolean(this.config.apiUrl && this.config.apiKey);
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.configured) throw new Error('SMS não configurado (SMS_API_URL / SMS_API_KEY)');
    const res = await fetch(this.config.apiUrl!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: `+${message.to}`, from: this.config.senderId, message: message.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(data.message ?? `SMS API respondeu ${res.status}`);
    return { providerMessageId: data.id };
  }
}
