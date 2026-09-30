import type { NotificationChannel } from '@gymflow/shared';
import { env } from '../../../config/env';
import type { NotificationProvider } from '../types';
import { ConsoleProvider } from './console';
import { SmtpEmailProvider } from './email-smtp';
import { HttpSmsProvider } from './sms-http';
import { MetaWhatsAppProvider } from './whatsapp-meta';

/** Selecciona o fornecedor de cada canal a partir das variáveis de ambiente. */
export function createProviders(): Record<NotificationChannel, NotificationProvider> {
  return {
    WHATSAPP:
      env.WHATSAPP_PROVIDER === 'meta'
        ? new MetaWhatsAppProvider({
            apiUrl: env.WHATSAPP_API_URL,
            accessToken: env.WHATSAPP_ACCESS_TOKEN,
            phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
          })
        : new ConsoleProvider('WHATSAPP'),
    EMAIL:
      env.EMAIL_PROVIDER === 'smtp'
        ? new SmtpEmailProvider({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
            from: env.EMAIL_FROM,
          })
        : new ConsoleProvider('EMAIL'),
    SMS:
      env.SMS_PROVIDER === 'http'
        ? new HttpSmsProvider({ apiUrl: env.SMS_API_URL, apiKey: env.SMS_API_KEY, senderId: env.SMS_SENDER_ID })
        : new ConsoleProvider('SMS'),
  };
}
