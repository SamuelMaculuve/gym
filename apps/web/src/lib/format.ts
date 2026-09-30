import { formatDateTime, formatMoney } from '@gymflow/shared';
import { useAuth } from './auth';

/** Formatação com a moeda e fuso horário do ginásio. */
export function useFormat() {
  const { gym } = useAuth();
  const currency = gym?.currency ?? 'MZN';
  const timezone = gym?.timezone ?? 'Africa/Maputo';
  return {
    money: (cents: number) => formatMoney(cents, currency),
    dateTime: (iso: string | null | undefined) => formatDateTime(iso, timezone),
    time: (iso: string | null | undefined) => (iso ? formatDateTime(iso, timezone).slice(11) : '—'),
    today: gym?.today ?? new Date().toISOString().slice(0, 10),
    rules: gym?.rules ?? { dueSoonDays: 7, expireAfterDays: 30 },
    currency,
    timezone,
  };
}
