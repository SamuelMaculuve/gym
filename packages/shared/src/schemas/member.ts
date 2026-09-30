import { z } from 'zod';
import { GENDERS, MEMBER_FILTERS, MEMBER_SORTS, PAYMENT_METHODS } from '../constants';
import { isoDate, money, optionalEmail, optionalIsoDate, optionalPhone, optionalText, paginationQuery, phone } from './common';

const personalFields = {
  fullName: z.string().trim().min(3, 'Indique o nome completo').max(120),
  phone,
  email: optionalEmail,
  birthDate: optionalIsoDate,
  gender: z.union([z.literal(''), z.enum(GENDERS)]).optional().nullable(),
  address: optionalText(200),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalPhone,
  notes: optionalText(1000),
};

/** Pagamento registado no próprio acto de inscrição (fluxo rápido da recepção). */
export const initialPaymentSchema = z.object({
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
});

export const memberCreateSchema = z.object({
  ...personalFields,
  joinedAt: isoDate,
  planId: z.string().optional().nullable(),
  startDate: optionalIsoDate,
  /** Permite ajustar a data de término calculada automaticamente. */
  endDate: optionalIsoDate,
  registerPayment: z.boolean().default(false),
  payment: initialPaymentSchema.optional().nullable(),
  sendWelcome: z.boolean().default(true),
});
export type MemberCreateInput = z.input<typeof memberCreateSchema>;

export const memberUpdateSchema = z.object({
  ...personalFields,
  joinedAt: isoDate,
  active: z.boolean(),
  notificationsEnabled: z.boolean(),
}).partial();
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

export const memberListQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  filter: z.enum(MEMBER_FILTERS).default('all'),
  planId: z.string().optional(),
  sort: z.enum(MEMBER_SORTS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type MemberListQuery = z.input<typeof memberListQuery>;
