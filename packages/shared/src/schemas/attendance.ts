import { z } from 'zod';
import { ATTENDANCE_METHODS } from '../constants';
import { isoDate, optionalText, paginationQuery, timeHHmm } from './common';

export const checkInSchema = z
  .object({
    memberId: z.string().optional(),
    /** Conteúdo lido do QR Code. */
    qrToken: z.string().optional(),
    /** Código de membro, telefone ou nome. */
    query: z.string().trim().optional(),
    method: z.enum(ATTENDANCE_METHODS).default('MANUAL'),
    /** Registar mesmo com a subscrição inválida (fica marcado). */
    force: z.boolean().default(false),
  })
  .refine((v) => v.memberId || v.qrToken || v.query, 'Indique o membro, código, telefone ou QR Code');
export type CheckInInput = z.input<typeof checkInSchema>;

export const manualAttendanceSchema = z.object({
  memberId: z.string().min(1, 'Seleccione o membro'),
  date: isoDate,
  checkInTime: timeHHmm,
  checkOutTime: z.union([z.literal(''), timeHHmm]).optional().nullable(),
  notes: optionalText(300),
});
export type ManualAttendanceInput = z.input<typeof manualAttendanceSchema>;

export const attendanceListQuery = paginationQuery.extend({
  from: isoDate.optional(),
  to: isoDate.optional(),
  memberId: z.string().optional(),
  q: z.string().trim().optional(),
});
export type AttendanceListQuery = z.input<typeof attendanceListQuery>;
