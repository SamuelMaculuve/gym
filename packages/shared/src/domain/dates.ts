/**
 * Datas de calendário no formato ISO `YYYY-MM-DD`, sempre interpretadas no fuso horário do ginásio.
 * A aritmética é feita em UTC para evitar problemas de horário de Verão.
 */
export type ISODate = string;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUTC(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}` as ISODate,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** Data local (no fuso do ginásio) de um instante. */
export function toLocalDate(instant: Date, timeZone: string): ISODate {
  return zonedParts(instant, timeZone).date;
}

/** "Hoje" no fuso do ginásio. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return toLocalDate(now, timeZone);
}

/** Hora local (0-23) no fuso do ginásio. */
export function localHour(timeZone: string, now: Date = new Date()): number {
  return zonedParts(now, timeZone).hour;
}

/** Hora local `HH:mm` de um instante. */
export function toLocalTime(instant: Date, timeZone: string): string {
  const { hour, minute } = zonedParts(instant, timeZone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Converte uma data + hora locais do ginásio num instante UTC.
 * Resolve o deslocamento do fuso iterativamente (suficiente para fusos reais).
 */
export function zonedDateTimeToInstant(date: ISODate, time: string, timeZone: string): Date {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const local = zonedParts(guess, timeZone);
  const localAsUTC = new Date(`${local.date}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:00Z`);
  const offset = localAsUTC.getTime() - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(new Date(toUTC(date).getTime() + days * DAY_MS));
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = toUTC(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return fromUTC(target);
}

/** Número de dias de `from` até `to` (positivo se `to` for posterior). */
export function diffDays(to: ISODate, from: ISODate): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / DAY_MS);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

/** Segunda-feira da semana da data (ISO: semana começa à segunda). */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -(isoWeekday(date) - 1));
}

/** 1 = segunda ... 7 = domingo */
export function isoWeekday(date: ISODate): number {
  const day = toUTC(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Lista de datas entre `from` e `to` (inclusive). */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** `2026-09-30` → `30/09/2026` */
export function formatDate(date: ISODate | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** `2026-09` → `Set 2026` */
export function formatMonth(key: string, withYear = true): string {
  const [y, m] = key.split('-');
  const label = MONTHS_PT[Number(m) - 1] ?? key;
  return withYear ? `${label} ${y}` : label;
}

/** Data/hora de um instante, no fuso indicado: `30/09/2026 14:05` */
export function formatDateTime(instant: string | Date | null | undefined, timeZone: string): string {
  if (!instant) return '—';
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return `${formatDate(toLocalDate(d, timeZone))} ${toLocalTime(d, timeZone)}`;
}

/** Idade completa em anos numa determinada data. */
export function ageOn(birthDate: ISODate, today: ISODate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}
