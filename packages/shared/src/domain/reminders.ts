import type { NotificationType } from '../constants';
import type { SubscriptionEvaluation } from './subscription-status';

export interface ReminderSettings {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  /** Dias antes do vencimento, ex.: [7, 3, 1] */
  daysBefore: number[];
  sendOnDueDate: boolean;
  /** Dias após o vencimento, ex.: [1, 7, 14] */
  overdueDays: number[];
  /** Depois do último valor de `overdueDays`, repetir a cada N dias (0 = não repetir). */
  overdueRepeatEveryDays: number;
  sendExpiredNotice: boolean;
  /** Hora local a partir da qual os lembretes automáticos são enviados. */
  sendHour: number;
  sendWelcome: boolean;
  sendPaymentConfirmation: boolean;
}

export interface ReminderCandidate {
  type: NotificationType;
  /** Identifica o limiar para a deduplicação, ex.: `before:7`, `due`, `overdue:14`, `expired`. */
  threshold: string;
}

/** Último limiar de atraso já alcançado, incluindo as repetições periódicas. */
export function latestOverdueThreshold(daysOverdue: number, settings: Pick<ReminderSettings, 'overdueDays' | 'overdueRepeatEveryDays'>): number | null {
  const fixed = [...new Set(settings.overdueDays)].filter((d) => d > 0).sort((a, b) => a - b);
  const reached = fixed.filter((d) => d <= daysOverdue);
  const last = fixed[fixed.length - 1];
  const repeat = settings.overdueRepeatEveryDays;
  if (last !== undefined && repeat > 0 && daysOverdue > last) {
    return last + Math.floor((daysOverdue - last) / repeat) * repeat;
  }
  if (last === undefined && repeat > 0 && daysOverdue >= repeat) {
    return Math.floor(daysOverdue / repeat) * repeat;
  }
  return reached.length ? reached[reached.length - 1] : null;
}

/**
 * Determina que lembrete(s) se aplicam hoje a uma subscrição, por ordem de prioridade.
 * Só se considera o limiar mais recente já alcançado, por isso se o motor falhar um dia
 * recupera no dia seguinte sem enviar mensagens antigas em série.
 * O motor envia o primeiro candidato que ainda não tenha sido enviado.
 */
export function resolveReminderCandidates(evaluation: SubscriptionEvaluation, settings: ReminderSettings): ReminderCandidate[] {
  const { status, daysUntilDue, daysOverdue } = evaluation;
  if (status === 'CANCELLED' || status === 'SUSPENDED') return [];

  if (daysUntilDue > 0) {
    const upcoming = settings.daysBefore.filter((d) => d > 0 && d >= daysUntilDue);
    if (upcoming.length === 0) return [];
    return [{ type: 'DUE_REMINDER', threshold: `before:${Math.min(...upcoming)}` }];
  }

  if (daysUntilDue === 0) {
    return settings.sendOnDueDate ? [{ type: 'DUE_TODAY', threshold: 'due' }] : [];
  }

  const candidates: ReminderCandidate[] = [];
  if (status === 'EXPIRED' && settings.sendExpiredNotice) {
    candidates.push({ type: 'EXPIRED', threshold: 'expired' });
  }
  const t = latestOverdueThreshold(daysOverdue, settings);
  if (t !== null) candidates.push({ type: 'OVERDUE', threshold: `overdue:${t}` });
  return candidates;
}

export function reminderDedupeKey(subscriptionId: string, candidate: ReminderCandidate, channel: string): string {
  return `${subscriptionId}:${candidate.type}:${candidate.threshold}:${channel}`;
}

/** Descrição legível do calendário de lembretes (usada nas configurações). */
export function describeReminderSchedule(settings: ReminderSettings): string[] {
  const lines: string[] = [];
  const before = [...settings.daysBefore].sort((a, b) => b - a);
  if (before.length) lines.push(`${before.join(', ')} dia(s) antes do vencimento`);
  if (settings.sendOnDueDate) lines.push('No dia do vencimento');
  const after = [...settings.overdueDays].sort((a, b) => a - b);
  if (after.length) lines.push(`${after.join(', ')} dia(s) depois do vencimento`);
  if (settings.overdueRepeatEveryDays > 0) lines.push(`Depois, a cada ${settings.overdueRepeatEveryDays} dia(s) até ao pagamento`);
  return lines;
}
