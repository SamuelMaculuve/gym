import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  renderTemplate,
  defaultTemplate,
  resetPasswordSchema,
  type MeResponse,
  type Role,
  type SessionResponse,
} from '@gymflow/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { badRequest, unauthorized } from '../../lib/errors';
import { buildGymContext } from '../../lib/gym';
import { prisma } from '../../lib/prisma';
import { randomToken, sha256 } from '../../lib/utils';
import { authenticate, currentUser, permissionsFor } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rate-limit';
import { body } from '../../middleware/validate';
import { renderEmailHtml } from '../../services/notifications/email-layout';
import { notificationService } from '../../services/notifications/notification-service';

export const authRouter = Router();

// Hash fictício para igualar o tempo de resposta quando o email não existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = body(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) throw unauthorized('Email ou palavra-passe incorrectos');

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000);
  await prisma.$transaction([
    prisma.session.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt, userAgent: req.get('user-agent')?.slice(0, 250), ip: req.ip },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  await audit({ gymId: user.gymId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, summary: `${user.name} iniciou sessão.`, ip: req.ip });

  const response: SessionResponse = {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role, gymId: user.gymId, permissions: permissionsFor(user.role as Role) },
  };
  res.json(response);
});

authRouter.post('/logout', authenticate, async (req, res) => {
  await prisma.session.update({ where: { id: currentUser(req).sessionId }, data: { revokedAt: new Date() } });
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const u = currentUser(req);
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: u.gymId } });
  const ctx = buildGymContext(gym);
  const response: MeResponse = {
    user: { id: u.id, name: u.name, email: u.email, role: u.role, gymId: u.gymId, permissions: permissionsFor(u.role) },
    gym: { id: gym.id, name: gym.name, logoUrl: gym.logoUrl, currency: gym.currency, timezone: gym.timezone, today: ctx.today, rules: ctx.rules },
  };
  res.json(response);
});

authRouter.post('/change-password', authenticate, async (req, res) => {
  const u = currentUser(req);
  const input = body(req, changePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) throw badRequest('A palavra-passe actual está incorrecta');
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } }),
    // Termina as outras sessões
    prisma.session.updateMany({ where: { userId: u.id, id: { not: u.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ gymId: u.gymId, userId: u.id, action: 'auth.change_password', entity: 'User', entityId: u.id, summary: `${u.name} alterou a palavra-passe.`, ip: req.ip });
  res.status(204).end();
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = body(req, forgotPasswordSchema);
  const user = await prisma.user.findUnique({ where: { email }, include: { gym: true } });
  // Resposta idêntica exista ou não o email (evita enumeração de contas).
  if (user?.active) {
    const token = randomToken(32);
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) } });
    const link = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
    const tpl = defaultTemplate('PASSWORD_RESET', 'EMAIL')!;
    const vars = { name: user.name.split(' ')[0], gym_name: user.gym.name, reset_link: link };
    const subject = renderTemplate(tpl.subject ?? '', vars);
    const text = renderTemplate(tpl.body, vars);
    void notificationService
      .sendEmail(user.email, subject, text, renderEmailHtml({ gymName: user.gym.name, logoUrl: user.gym.logoUrl, subject, text, ctaUrl: link, ctaLabel: 'Redefinir palavra-passe' }))
      .catch((e) => console.error('Falha ao enviar email de recuperação', e));
  }
  res.json({ ok: true });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const input = body(req, resetPasswordSchema);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(input.token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw badRequest('Link inválido ou expirado. Peça um novo.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(input.password, 12) } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ gymId: reset.user.gymId, userId: reset.userId, action: 'auth.reset_password', entity: 'User', entityId: reset.userId, summary: `${reset.user.name} redefiniu a palavra-passe.`, ip: req.ip });
  res.json({ ok: true });
});
