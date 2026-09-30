import { z } from 'zod';
import { money, optionalText } from './common';

export const planSchema = z.object({
  name: z.string().trim().min(2, 'Indique o nome do plano').max(60),
  description: optionalText(300),
  price: money,
  durationDays: z.number({ error: 'Indique a duração' }).int('Número inteiro de dias').min(1, 'Mínimo 1 dia').max(3650),
  durationLabel: optionalText(40),
  active: z.boolean().default(true),
});
export type PlanInput = z.input<typeof planSchema>;
