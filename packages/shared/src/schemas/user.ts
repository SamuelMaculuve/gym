import { z } from 'zod';
import { ROLES } from '../constants';
import { passwordSchema } from './auth';

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Indique o nome').max(100),
  email: z.email('Email inválido').trim().toLowerCase(),
  role: z.enum(ROLES),
  password: passwordSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  role: z.enum(ROLES),
  active: z.boolean(),
}).partial();
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userResetPasswordSchema = z.object({ password: passwordSchema });
