import { z } from 'zod';
import { isoDate } from './common';

export const reportQuery = z.object({
  from: isoDate,
  to: isoDate,
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
});
export type ReportQuery = z.input<typeof reportQuery>;

export const auditListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
  entity: z.string().optional(),
  userId: z.string().optional(),
  q: z.string().trim().optional(),
});
export type AuditListQuery = z.input<typeof auditListQuery>;
