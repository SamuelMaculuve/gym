import { Router } from 'express';
import type { Gym } from '@prisma/client';
import { gymSettingsSchema, normalizePhone, type GymSettings } from '@gymflow/shared';
import { audit, diff } from '../../lib/audit';
import { buildGymContext } from '../../lib/gym';
import { prisma } from '../../lib/prisma';
import { emptyToNull } from '../../lib/utils';
import { currentUser, requirePermission } from '../../middleware/auth';
import { body } from '../../middleware/validate';
import { notificationService } from '../../services/notifications/notification-service';

export const settingsRouter = Router();

function toSettings(gym: Gym): GymSettings {
  const ctx = buildGymContext(gym);
  return {
    id: gym.id,
    name: gym.name,
    logoUrl: gym.logoUrl,
    phone: gym.phone,
    email: gym.email,
    address: gym.address,
    whatsapp: gym.whatsapp,
    currency: gym.currency,
    timezone: gym.timezone,
    openingDays: ctx.openingDays,
    openingTime: gym.openingTime,
    closingTime: gym.closingTime,
    memberCodePrefix: gym.memberCodePrefix,
    dueSoonDays: gym.dueSoonDays,
    expireAfterDays: gym.expireAfterDays,
    paymentLinkEnabled: gym.paymentLinkEnabled,
    notifications: ctx.reminders,
    providers: notificationService.providerStatus(),
  };
}

settingsRouter.get('/', requirePermission('settings:read', 'notifications:read'), async (req, res) => {
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: currentUser(req).gymId } });
  res.json(toSettings(gym));
});

settingsRouter.put('/', requirePermission('settings:write'), async (req, res) => {
  const user = currentUser(req);
  const input = body(req, gymSettingsSchema);
  const existing = await prisma.gym.findUniqueOrThrow({ where: { id: user.gymId } });
  const data = {
    name: input.name,
    logoUrl: emptyToNull(input.logoUrl),
    phone: emptyToNull(input.phone) ? normalizePhone(input.phone!) : null,
    email: emptyToNull(input.email),
    address: emptyToNull(input.address),
    whatsapp: emptyToNull(input.whatsapp) ? normalizePhone(input.whatsapp!) : null,
    currency: input.currency.toUpperCase(),
    timezone: input.timezone,
    openingDays: JSON.stringify([...new Set(input.openingDays)].sort()),
    openingTime: input.openingTime,
    closingTime: input.closingTime,
    memberCodePrefix: input.memberCodePrefix,
    dueSoonDays: input.dueSoonDays,
    expireAfterDays: input.expireAfterDays,
    paymentLinkEnabled: input.paymentLinkEnabled,
    notificationSettings: JSON.stringify({
      ...input.notifications,
      daysBefore: [...new Set(input.notifications.daysBefore)].sort((a, b) => b - a),
      overdueDays: [...new Set(input.notifications.overdueDays)].sort((a, b) => a - b),
    }),
  };
  const changes = diff({ ...existing, logoUrl: existing.logoUrl ? '[logo]' : null } as unknown as Record<string, unknown>, {
    ...data,
    logoUrl: data.logoUrl ? (data.logoUrl === existing.logoUrl ? '[logo]' : '[novo logo]') : null,
  });
  const gym = await prisma.gym.update({ where: { id: user.gymId }, data });
  if (changes.changed.length) {
    await audit({
      gymId: user.gymId,
      userId: user.id,
      action: 'settings.update',
      entity: 'Gym',
      entityId: gym.id,
      summary: `${user.name} alterou as configurações do ginásio (${changes.changed.join(', ')}).`,
      before: changes.before,
      after: changes.after,
      ip: req.ip,
    });
  }
  res.json(toSettings(gym));
});
