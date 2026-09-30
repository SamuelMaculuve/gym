import type { SubscriptionState, SubscriptionStatus } from '../constants';
import { addDays, diffDays, type ISODate } from './dates';

export interface SubscriptionLike {
  startDate: ISODate;
  endDate: ISODate;
  amountCents: number;
  amountPaidCents: number;
  state: SubscriptionState;
}

export interface StatusRules {
  /** Dias antes do vencimento em que a subscrição passa a "A vencer". */
  dueSoonDays: number;
  /** Dias de atraso após os quais a subscrição passa a "Expirada". */
  expireAfterDays: number;
}

export interface SubscriptionEvaluation {
  status: SubscriptionStatus;
  /** Só é verdadeiro quando existem pagamentos válidos que cobrem o valor do período. */
  paid: boolean;
  /** Data até à qual o pagamento é devido (fim do período se pago, início se não pago). */
  dueDate: ISODate;
  /** Dias até `dueDate` (negativo = em atraso). */
  daysUntilDue: number;
  daysOverdue: number;
  /** O membro pode entrar no ginásio. */
  accessAllowed: boolean;
}

export function isSubscriptionPaid(sub: Pick<SubscriptionLike, 'amountCents' | 'amountPaidCents'>): boolean {
  return sub.amountPaidCents >= sub.amountCents && sub.amountCents >= 0;
}

/**
 * Regra central do sistema: calcula o estado de um período de subscrição.
 * Chegar ao vencimento nunca marca como pago — sem pagamento passa a OVERDUE no dia seguinte.
 */
export function evaluateSubscription(sub: SubscriptionLike, today: ISODate, rules: StatusRules): SubscriptionEvaluation {
  const paid = isSubscriptionPaid(sub);
  const dueDate = paid ? sub.endDate : sub.startDate;
  const daysUntilDue = diffDays(dueDate, today);
  const daysOverdue = Math.max(0, -daysUntilDue);

  let status: SubscriptionStatus;
  if (sub.state === 'CANCELLED') status = 'CANCELLED';
  else if (sub.state === 'SUSPENDED') status = 'SUSPENDED';
  else if (daysUntilDue < 0) status = daysOverdue > rules.expireAfterDays ? 'EXPIRED' : 'OVERDUE';
  else if (daysUntilDue <= rules.dueSoonDays) status = 'DUE_SOON';
  else status = 'ACTIVE';

  const accessAllowed = paid && (status === 'ACTIVE' || status === 'DUE_SOON');
  return { status, paid, dueDate, daysUntilDue, daysOverdue, accessAllowed };
}

/** Data de término inclusiva: um plano de 30 dias a começar a 1 termina a 30. */
export function computeEndDate(startDate: ISODate, durationDays: number): ISODate {
  return addDays(startDate, Math.max(1, durationDays) - 1);
}

/**
 * Início do próximo período ao renovar. Continua a partir do fim do período anterior
 * (o membro paga os dias em atraso) salvo se a subscrição já estiver expirada.
 */
export function nextPeriodStart(previousEndDate: ISODate | null, today: ISODate, rules: StatusRules): ISODate {
  if (!previousEndDate) return today;
  const candidate = addDays(previousEndDate, 1);
  return diffDays(today, candidate) > rules.expireAfterDays ? today : candidate;
}

/**
 * Escolhe o período "actual" de um membro: o mais recente não cancelado
 * ou, se todos estiverem cancelados, o mais recente.
 */
export function pickCurrentSubscription<T extends { startDate: ISODate; state: SubscriptionState; createdAt?: string | Date }>(
  subs: T[],
): T | null {
  if (subs.length === 0) return null;
  const sorted = [...subs].sort((a, b) => (a.startDate === b.startDate ? 0 : a.startDate < b.startDate ? 1 : -1));
  return sorted.find((s) => s.state !== 'CANCELLED') ?? sorted[0];
}

/** Membro conta como activo enquanto a subscrição não expirou nem foi suspensa/cancelada. */
export function isMemberActive(memberActive: boolean, status: SubscriptionStatus | null): boolean {
  return memberActive && (status === 'ACTIVE' || status === 'DUE_SOON' || status === 'OVERDUE');
}
