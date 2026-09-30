/**
 * Motor de lembretes como Scheduled Function da Netlify: corre a cada hora e cada ginásio
 * só envia a partir da hora configurada. É idempotente (chaves de deduplicação na base de dados).
 */
import { runReminders } from '../../apps/api/src/jobs/reminders';
import { inMemoryDb } from '../../apps/api/src/lib/prisma';

export default async () => {
  // Modo demonstração (sem base de dados real): não há lembretes a enviar.
  if (inMemoryDb) return new Response(JSON.stringify({ skipped: 'demo' }), { headers: { 'content-type': 'application/json' } });
  const result = await runReminders();
  console.info(`[lembretes] processados=${result.processed} enviados=${result.sent} falhados=${result.failed}`);
  return new Response(JSON.stringify({ ...result, items: result.items.length }), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '@hourly' };
