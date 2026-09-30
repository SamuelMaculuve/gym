import { z } from 'zod';
import { optionalEmail, optionalPhone, optionalText, timeHHmm } from './common';

const dayList = z.array(z.number().int().min(1).max(365)).max(10);

export const notificationSettingsSchema = z.object({
  whatsappEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  daysBefore: dayList,
  sendOnDueDate: z.boolean(),
  overdueDays: dayList,
  overdueRepeatEveryDays: z.number().int().min(0).max(90),
  sendExpiredNotice: z.boolean(),
  sendHour: z.number().int().min(0).max(23),
  sendWelcome: z.boolean(),
  sendPaymentConfirmation: z.boolean(),
});
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

export const gymSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Indique o nome do ginásio').max(100),
  logoUrl: z
    .string()
    .max(400_000, 'Imagem demasiado grande (máx. ~300 KB)')
    .refine((v) => v === '' || /^https?:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(v), 'Imagem inválida')
    .optional()
    .nullable(),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(200),
  whatsapp: optionalPhone,
  currency: z.string().length(3),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Fuso horário inválido'),
  openingDays: z.array(z.number().int().min(1).max(7)),
  openingTime: timeHHmm,
  closingTime: timeHHmm,
  memberCodePrefix: z.string().trim().regex(/^[A-Z]{2,6}$/, '2 a 6 letras maiúsculas'),
  dueSoonDays: z.number().int().min(0).max(60),
  expireAfterDays: z.number().int().min(0).max(365),
  paymentLinkEnabled: z.boolean(),
  notifications: notificationSettingsSchema,
});
export type GymSettingsInput = z.infer<typeof gymSettingsSchema>;
