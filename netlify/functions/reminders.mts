/**
 * Motor de lembretes como Scheduled Function da Netlify: corre a cada hora e cada ginásio
 * só envia a partir da hora configurada. É idempotente (chaves de deduplicação na base de dados).
 */
import { runReminders } from '../../apps/api/src/jobs/reminders';

export default async () => {
  const result = await runReminders();
  console.info(`[lembretes] processados=${result.processed} enviados=${result.sent} falhados=${result.failed}`);
  return new Response(JSON.stringify({ ...result, items: result.items.length }), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '@hourly' };
