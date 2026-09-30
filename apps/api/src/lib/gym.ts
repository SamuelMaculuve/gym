import type { Gym } from '@prisma/client';
import { todayIn, type ReminderSettings, type StatusRules } from '@gymflow/shared';
import { prisma } from './prisma';
import { notFound } from './errors';
import { parseJson } from './utils';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  whatsappEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  daysBefore: [7, 3, 1],
  sendOnDueDate: true,
  overdueDays: [1, 7, 14],
  overdueRepeatEveryDays: 7,
  sendExpiredNotice: true,
  sendHour: 9,
  sendWelcome: true,
  sendPaymentConfirmation: true,
};

/** Contexto do ginásio usado por quase todos os serviços: fuso, "hoje" e regras. */
export interface GymContext {
  gym: Gym;
  today: string;
  rules: StatusRules;
  reminders: ReminderSettings;
  openingDays: number[];
}

export function buildGymContext(gym: Gym, now = new Date()): GymContext {
  return {
    gym,
    today: todayIn(gym.timezone, now),
    rules: { dueSoonDays: gym.dueSoonDays, expireAfterDays: gym.expireAfterDays },
    reminders: { ...DEFAULT_REMINDER_SETTINGS, ...parseJson<Partial<ReminderSettings>>(gym.notificationSettings, {}) },
    openingDays: parseJson<number[]>(gym.openingDays, [1, 2, 3, 4, 5, 6]),
  };
}

export async function getGymContext(gymId: string): Promise<GymContext> {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) throw notFound('Ginásio não encontrado');
  return buildGymContext(gym);
}
