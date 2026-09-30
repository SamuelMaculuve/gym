import type { NotificationChannel } from '@gymflow/shared';

export interface OutgoingMessage {
  to: string;
  subject?: string | null;
  text: string;
  html?: string;
}

export interface SendResult {
  providerMessageId?: string;
}

/**
 * Contrato de um fornecedor de mensagens. Para trocar de fornecedor (ex.: Twilio, 360dialog,
 * SendGrid) basta criar uma nova implementação e registá-la em `providers/index.ts`.
 */
export interface NotificationProvider {
  readonly name: string;
  readonly channel: NotificationChannel;
  readonly configured: boolean;
  send(message: OutgoingMessage): Promise<SendResult>;
}
