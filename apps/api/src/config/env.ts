import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Opcional: na Netlify a ligação vem de NETLIFY_DB_URL (ver lib/prisma.ts).
  DATABASE_URL: z.string().optional(),
  // Na Netlify, URL é o endereço principal do site (definido automaticamente).
  CORS_ORIGIN: z.string().default(process.env.URL ?? 'http://localhost:5173'),
  PUBLIC_APP_URL: z.string().url().default(process.env.URL ?? 'http://localhost:5173'),
  /** Obrigatório na Netlify para o assistente de configuração inicial (/setup). */
  SETUP_TOKEN: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(72),
  CRON_SECRET: z.string().optional(),
  REMINDERS_CRON_ENABLED: bool,
  TRUST_PROXY: bool,
  NETLIFY: bool,

  WHATSAPP_PROVIDER: z.enum(['webhook', 'meta', 'console']).default('console'),
  WHATSAPP_WEBHOOK_URL: z.string().url().optional(),
  WHATSAPP_WEBHOOK_USERNAME: z.string().optional(),
  WHATSAPP_WEBHOOK_PASSWORD: z.string().optional(),
  /**
   * Lista de destinatários autorizados (telefones e/ou emails, separados por vírgula).
   * Se definida, só estes recebem mensagens reais — os restantes ficam "Ignorados".
   * Use em desenvolvimento e em sites de demonstração para nunca contactar números fictícios.
   */
  NOTIFICATIONS_ALLOWLIST: z.string().optional(),
  WHATSAPP_API_URL: z.string().default('https://graph.facebook.com/v21.0'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('GymFlow <no-reply@example.com>'),

  SMS_PROVIDER: z.enum(['http', 'console']).default('console'),
  SMS_API_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Lançar (em vez de process.exit) para funcionar também dentro de funções serverless.
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
export const onNetlify = env.NETLIFY;

if (isProduction && (!env.CRON_SECRET || env.CRON_SECRET.length < 24)) {
  console.warn('⚠️  CRON_SECRET ausente ou curto: o endpoint /api/cron/reminders ficará desactivado.');
}
