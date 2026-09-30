import type { NotificationChannel } from '@gymflow/shared';
import type { NotificationProvider, OutgoingMessage, SendResult } from '../types';

/** Fornecedor de desenvolvimento: escreve a mensagem no terminal em vez de a enviar. */
export class ConsoleProvider implements NotificationProvider {
  readonly name = 'console';
  readonly configured = true;
  constructor(readonly channel: NotificationChannel) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const preview = message.text.length > 160 ? `${message.text.slice(0, 160)}…` : message.text;
    console.info(`[notificação:${this.channel}] → ${message.to}${message.subject ? ` | ${message.subject}` : ''}\n  ${preview.replace(/\n/g, ' ')}`);
    return { providerMessageId: `console-${Date.now()}` };
  }
}
