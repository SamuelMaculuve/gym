/**
 * Agendamento local (servidor Express dedicado). Fica num ficheiro à parte porque o node-cron
 * usa import.meta.url ao carregar e rebenta no bundle CommonJS das Netlify Functions,
 * que agendam os lembretes com netlify/functions/reminders.mts.
 */
import cron from 'node-cron';
import { runReminders } from './reminders';

/** Agenda o motor de lembretes a cada hora (respeita a hora de envio de cada ginásio). */
export function scheduleReminders() {
  cron.schedule('5 * * * *', () => {
    runReminders()
      .then((r) => r.processed && console.info(`[lembretes] processados=${r.processed} enviados=${r.sent} falhados=${r.failed}`))
      .catch((e) => console.error('[lembretes] erro', e));
  });
  console.info('[lembretes] agendados (a cada hora, ao minuto 5)');
}
