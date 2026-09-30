import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../constants';
import { isoDate, money, optionalText, paginationQuery } from './common';

export const paymentCreateSchema = z.object({
  memberId: z.string().min(1, 'Seleccione o membro'),
  /** Plano para a renovação. Se omitido, mantém o plano actual. */
  planId: z.string().optional().nullable(),
  amount: money.refine((v) => v > 0, 'O valor deve ser superior a zero'),
  paymentDate: isoDate,
  method: z.enum(PAYMENT_METHODS, { error: 'Seleccione o método' }),
  reference: optionalText(80),
  notes: optionalText(500),
  sendConfirmation: z.boolean().default(true),
});
export type PaymentCreateInput = z.input<typeof paymentCreateSchema>;

export const paymentCancelSchema = z.object({
  status: z.enum(['CANCELLED', 'REFUNDED']),
  reason: z.string().trim().min(3, 'Indique o motivo').max(300),
});
export type PaymentCancelInput = z.infer<typeof paymentCancelSchema>;

export const paymentListQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  memberId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type PaymentListQuery = z.input<typeof paymentListQuery>;
