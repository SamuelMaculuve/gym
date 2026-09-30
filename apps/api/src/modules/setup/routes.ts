import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { setupSchema, type Role, type SessionResponse, type SetupStatus } from '@gymflow/shared';
import { env, onNetlify } from '../../config/env';
import { audit } from '../../lib/audit';
import { conflict, forbidden } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { randomToken, sha256 } from '../../lib/utils';
import { createDemoData } from '../../demo/demo-data';
import { permissionsFor } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rate-limit';
import { body } from '../../middleware/validate';
import { createGymWithDefaults, DEMO_USERS } from './bootstrap';

export const setupRouter = Router();

/**
 * Na Netlify o site é público desde o primeiro deploy: sem SETUP_TOKEN, qualquer pessoa
 * poderia criar a conta de administrador. Por isso a configuração exige o token lá.
 */
function setupStatus(needsSetup: boolean): SetupStatus {
  const tokenRequired = Boolean(env.SETUP_TOKEN) || onNetlify;
  return { needsSetup, tokenRequired, blocked: needsSetup && onNetlify && !env.SETUP_TOKEN };
}

function tokenMatches(given: string | undefined) {
  const expected = env.SETUP_TOKEN;
  if (!expected) return !onNetlify;
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

setupRouter.get('/status', async (_req, res) => {
  res.json(setupStatus((await prisma.user.count()) === 0));
});

setupRouter.post('/', authLimiter, async (req, res) => {
  const input = body(req, setupSchema);
  const status = setupStatus((await prisma.user.count()) === 0);
  if (!status.needsSetup) throw conflict('O sistema já está configurado. Inicie sessão.');
  if (status.blocked) throw forbidden('Defina a variável SETUP_TOKEN nas configurações do site na Netlify e volte a fazer deploy.');
  if (!tokenMatches(input.setupToken)) throw forbidden('Código de configuração inválido');

  const passwordHash = await bcrypt.hash(input.password, 12);
  // Contas de demonstração que não colidam com o email do administrador
  const demoUsers = input.createDemoUsers
    ? await Promise.all(
        DEMO_USERS.filter((u) => u.email !== input.email).map(async (u) => ({ ...u, passwordHash: await bcrypt.hash(u.password, 10) })),
      )
    : [];
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000);

  const user = await prisma.$transaction(
    async (tx) => {
      // Verificação dentro da transacção: evita dois administradores em pedidos simultâneos.
      if ((await tx.user.count()) > 0) throw conflict('O sistema já está configurado.');
      const { gym, plans } = await createGymWithDefaults(tx, {
        name: input.gymName,
        currency: input.currency,
        timezone: input.timezone,
        createDefaultPlans: input.createDefaultPlans || input.includeDemoData,
      });
      const admin = await tx.user.create({ data: { gymId: gym.id, name: input.adminName, email: input.email, role: 'ADMIN', passwordHash, lastLoginAt: new Date() } });
      const staff = [];
      for (const u of demoUsers) {
        staff.push(await tx.user.create({ data: { gymId: gym.id, name: u.name, email: u.email, role: u.role, passwordHash: u.passwordHash } }));
      }
      if (input.includeDemoData && plans.length >= 4) {
        const reception = staff.find((u) => u.role === 'RECEPTIONIST');
        const manager = staff.find((u) => u.role === 'MANAGER');
        await createDemoData(tx, {
          gym,
          plans,
          staff: reception ? [reception, reception, reception, manager ?? admin] : [admin],
          manager: manager ?? admin,
          notificationsEnabled: false,
        });
      }
      await tx.session.create({ data: { userId: admin.id, tokenHash: sha256(token), expiresAt, userAgent: req.get('user-agent')?.slice(0, 250), ip: req.ip } });
      await audit(
        {
          gymId: gym.id,
          userId: admin.id,
          action: 'setup.complete',
          entity: 'Gym',
          entityId: gym.id,
          summary: `${admin.name} configurou o ginásio ${gym.name}${input.includeDemoData ? ' com dados de demonstração' : ''}${demoUsers.length ? ` e ${demoUsers.length} contas de demonstração` : ''}.`,
          ip: req.ip,
        },
        tx,
      );
      return admin;
    },
    { timeout: 25_000, maxWait: 10_000 },
  );

  const response: SessionResponse = {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role, gymId: user.gymId, permissions: permissionsFor(user.role as Role) },
  };
  res.status(201).json(response);
});
