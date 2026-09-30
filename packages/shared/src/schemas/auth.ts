import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'Deve conter pelo menos uma letra')
  .regex(/\d/, 'Deve conter pelo menos um número');

export const loginSchema = z.object({
  email: z.email('Email inválido').trim().toLowerCase(),
  password: z.string().min(1, 'Indique a palavra-passe'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email('Email inválido').trim().toLowerCase(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Indique a palavra-passe actual'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
