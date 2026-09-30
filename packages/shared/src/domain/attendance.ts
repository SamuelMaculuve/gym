import { diffDays, startOfMonth, type ISODate } from './dates';

export interface AttendanceStats {
  totalVisits: number;
  visitsThisMonth: number;
  lastVisit: ISODate | null;
  /** Média de visitas por semana desde a primeira visita (ou inscrição). */
  weeklyAverage: number;
  daysSinceLastVisit: number | null;
}

/** Estatísticas de presença a partir das datas de visita de um membro. */
export function computeAttendanceStats(visitDates: ISODate[], today: ISODate, since?: ISODate): AttendanceStats {
  const unique = [...new Set(visitDates)].sort();
  const monthStart = startOfMonth(today);
  const lastVisit = unique.length ? unique[unique.length - 1] : null;
  const first = since && unique[0] ? (since < unique[0] ? since : unique[0]) : (unique[0] ?? since ?? today);
  const weeks = Math.max(1, (diffDays(today, first) + 1) / 7);
  return {
    totalVisits: visitDates.length,
    visitsThisMonth: visitDates.filter((d) => d >= monthStart && d <= today).length,
    lastVisit,
    weeklyAverage: Math.round((visitDates.length / weeks) * 10) / 10,
    daysSinceLastVisit: lastVisit ? diffDays(today, lastVisit) : null,
  };
}
