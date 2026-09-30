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
