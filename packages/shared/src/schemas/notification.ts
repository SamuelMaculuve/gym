import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from '../constants';
import { paginationQuery } from './common';

export const templateUpdateSchema = z.object({
  subject: z.string().trim().max(150).optional().nullable(),
  body: z.string().trim().min(5, 'A mensagem é demasiado curta').max(4000),
  active: z.boolean(),
});
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

export const sendNotificationSchema = z.object({
  memberId: z.string().min(1),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1, 'Seleccione pelo menos um canal'),
  type: z.enum(NOTIFICATION_TYPES).default('CUSTOM'),
  subject: z.string().trim().max(150).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
});
export type SendNotificationInput = z.input<typeof sendNotificationSchema>;

export const notificationListQuery = paginationQuery.extend({
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  memberId: z.string().optional(),
  q: z.string().trim().optional(),
});
export type NotificationListQuery = z.input<typeof notificationListQuery>;

/** Envio manual e individual de um lembrete (botão "Enviar lembrete"). */
export const REMINDER_KINDS = ['auto', 'reminder', 'warning'] as const;
export const reminderSendSchema = z.object({
  memberId: z.string().min(1),
  /** auto: lembrete se ainda não venceu, aviso de atraso se já venceu. */
  kind: z.enum(REMINDER_KINDS).default('auto'),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).optional(),
});
export type ReminderSendInput = z.input<typeof reminderSendSchema>;

/** Público de um envio em massa (subconjunto dos filtros de membros). */
export const BROADCAST_AUDIENCES = ['active', 'all', 'due_7_days', 'due_today', 'overdue', 'inactive'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

/**
 * Envio em massa. Email: mensagem livre (assunto + texto, com variáveis como {{name}}).
 * WhatsApp: lembrete de vencimento ou aviso de atraso consoante o estado de cada membro
 * (templates aprovados). SMS: em breve.
 */
export const broadcastSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  audience: z.enum(BROADCAST_AUDIENCES).default('active'),
  subject: z.string().trim().max(150).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  /** true = só conta os destinatários, não envia. */
  dryRun: z.boolean().default(false),
});
export type BroadcastInput = z.input<typeof broadcastSchema>;
