import type { NotificationChannel, NotificationType } from '@gymflow/shared';

/** Dados estruturados da mensagem, para fornecedores baseados em templates (ex.: webhook). */
export interface MessageContext {
  type: NotificationType;
  memberName: string;
  memberCode: string;
  gymName: string;
  planName: string;
  /** Data de vencimento formatada (dd/mm/aaaa) */
  dueDate: string;
  amount: string;
  paymentLink: string;
}

export interface OutgoingMessage {
  to: string;
  subject?: string | null;
  text: string;
  html?: string;
  context?: MessageContext;
}

export interface SendResult {
  providerMessageId?: string;
}

/**
 * O fornecedor não suporta este tipo de mensagem (ex.: o webhook só tem templates de
 * lembrete e de aviso). A notificação fica registada como "Ignorada", não como falha.
 */
export class UnsupportedMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMessageError';
  }
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
