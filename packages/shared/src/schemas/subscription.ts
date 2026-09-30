import { z } from 'zod';
import { SUBSCRIPTION_STATUSES } from '../constants';
import { isoDate, optionalIsoDate, optionalText, paginationQuery } from './common';

export const subscriptionCreateSchema = z.object({
  memberId: z.string().min(1, 'Seleccione o membro'),
  planId: z.string().min(1, 'Seleccione o plano'),
  startDate: isoDate,
  endDate: optionalIsoDate,
});
export type SubscriptionCreateInput = z.input<typeof subscriptionCreateSchema>;

export const subscriptionActionSchema = z.object({
  reason: optionalText(300),
});
export type SubscriptionActionInput = z.infer<typeof subscriptionActionSchema>;

export const subscriptionRemindersSchema = z.object({
  remindersPaused: z.boolean(),
});

export const subscriptionListQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  planId: z.string().optional(),
});
export type SubscriptionListQuery = z.input<typeof subscriptionListQuery>;
