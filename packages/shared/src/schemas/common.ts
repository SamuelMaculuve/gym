import { z } from 'zod';
import { isISODate } from '../domain/dates';
import { isValidPhone } from '../domain/identity';

export const isoDate = z.string().refine(isISODate, 'Data inválida');
export const optionalIsoDate = z.union([z.literal(''), isoDate]).optional().nullable();
export const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');

export const phone = z.string().trim().min(1, 'Número de celular obrigatório').refine(isValidPhone, 'Número de telefone inválido');
export const optionalPhone = z.union([z.literal(''), phone]).optional().nullable();

export const optionalEmail = z.union([z.literal(''), z.email('Email inválido')]).optional().nullable();

export const optionalText = (max = 500) => z.string().trim().max(max, `Máximo de ${max} caracteres`).optional().nullable();

export const money = z
  .number({ error: 'Indique um valor' })
  .nonnegative('O valor não pode ser negativo')
  .max(100_000_000, 'Valor demasiado alto')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo de 2 casas decimais');

export const idSchema = z.string().min(1);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const dateRangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
