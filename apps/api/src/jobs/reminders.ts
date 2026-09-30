import cron from 'node-cron';
import {
  localHour,
  reminderDedupeKey,
  resolveReminderCandidates,
  type NotificationChannel,
  type ReminderRunResult,
} from '@gymflow/shared';
import { buildGymContext } from '../lib/gym';
import { evaluate } from '../lib/mappers';
import { prisma } from '../lib/prisma';
import { notificationService } from '../services/notifications/notification-service';

interface RunOptions {
  gymId?: string;
  dryRun?: boolean;
  /** Ignora a hora de envio configurada (execução manual). */
  force?: boolean;
  triggeredBy?: string;
}

let running = false;

/**
 * Motor de lembretes. Idempotente: pode correr várias vezes por dia — a chave de
 * deduplicação (subscrição + tipo + limiar + canal) garante um único envio por período.
 */
export async function runReminders(options: RunOptions = {}): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { processed: 0, sent: 0, failed: 0, skipped: 0, dryRun: Boolean(options.dryRun), items: [] };
  if (running && !options.dryRun) return result;
  if (!options.dryRun) running = true;

  try {
    const gyms = await prisma.gym.findMany({ where: options.gymId ? { id: options.gymId } : {} });
    for (const gym of gyms) {
      const ctx = buildGymContext(gym);
      if (!options.force && !options.dryRun && localHour(gym.timezone) < ctx.reminders.sendHour) continue;

      const channels = notificationService.enabledChannels(ctx);
      if (channels.length === 0) continue;

      const members = await prisma.member.findMany({
        where: {
          gymId: gym.id,
          active: true,
          notificationsEnabled: true,
          currentSubscription: { state: 'NORMAL', remindersPaused: false },
        },
        include: { currentSubscription: { include: { plan: true } } },
      });

      for (const member of members) {
        const sub = member.currentSubscription!;
        const candidates = resolveReminderCandidates(evaluate(sub, ctx), ctx.reminders);
        if (candidates.length === 0) continue;
        result.processed++;

        const reachable = channels.filter((c) => (c === 'EMAIL' ? Boolean(member.email) : Boolean(member.phone)));
        for (const candidate of candidates) {
          const keys = new Map<NotificationChannel, string>(reachable.map((c) => [c, reminderDedupeKey(sub.id, candidate, c)]));
          const already = await prisma.notification.findMany({ where: { dedupeKey: { in: [...keys.values()] } }, select: { dedupeKey: true } });
          const sentKeys = new Set(already.map((n) => n.dedupeKey));
          const pending = reachable.filter((c) => !sentKeys.has(keys.get(c)!));
          if (pending.length === 0) continue; // este candidato já foi tratado; tenta o seguinte

          const outcomes = await notificationService.notifyMember({
            ctx,
            member,
            subscription: sub,
            type: candidate.type,
            channels: pending,
            dedupeKey: (c) => keys.get(c)!,
            triggeredBy: options.triggeredBy ?? 'system',
            dryRun: options.dryRun,
          });
          for (const o of outcomes) {
            if (o.status === 'SENT') result.sent++;
            else if (o.status === 'FAILED') result.failed++;
            else if (o.status !== 'WOULD_SEND') result.skipped++;
            result.items.push({
              memberId: member.id,
              memberName: member.fullName,
              type: candidate.type,
              channel: o.channel,
              status: o.status === 'DUPLICATE' ? 'SKIPPED' : o.status,
            });
          }
          break; // um lembrete por membro por execução
        }
      }
    }
  } finally {
    if (!options.dryRun) running = false;
  }
  return result;
}

/** Agenda o motor de lembretes a cada hora (respeita a hora de envio de cada ginásio). */
export function scheduleReminders() {
  cron.schedule('5 * * * *', () => {
    runReminders()
      .then((r) => r.processed && console.info(`[lembretes] processados=${r.processed} enviados=${r.sent} falhados=${r.failed}`))
      .catch((e) => console.error('[lembretes] erro', e));
  });
  console.info('[lembretes] agendados (a cada hora, ao minuto 5)');
}
