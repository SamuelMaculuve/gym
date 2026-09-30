/**
 * Ginásio de demonstração completo: ginásio, planos, 4 contas (uma por perfil) e o histórico
 * de createDemoData. Usado pelo seed local e pela base de dados em memória (modo demonstração).
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { createGymWithDefaults } from '../modules/setup/bootstrap';
import { createDemoData } from './demo-data';

export const DEMO_ACCOUNTS = [
  { name: 'Administrador', email: 'admin@gymflow.co.mz', role: 'ADMIN', password: 'Admin@2026' },
  { name: 'Marta Sitoe', email: 'gestor@gymflow.co.mz', role: 'MANAGER', password: 'Gestor@2026' },
  { name: 'Samuel Cossa', email: 'recepcao@gymflow.co.mz', role: 'RECEPTIONIST', password: 'Recepcao@2026' },
  { name: 'Helena Tembe', email: 'contabilidade@gymflow.co.mz', role: 'ACCOUNTANT', password: 'Conta@2026' },
] as const;

export async function seedDemo(db: PrismaClient, opts: { notificationsEnabled?: boolean } = {}) {
  const { gym, plans } = await createGymWithDefaults(db, {
    name: 'Força Total Fitness',
    phone: '258841000100',
    whatsapp: '258841000100',
    email: 'geral@forcatotal.co.mz',
    address: 'Av. Julius Nyerere, 1234 — Maputo',
  });
  await db.plan.create({
    data: { gymId: gym.id, name: 'Estudante (descontinuado)', description: 'Plano antigo para estudantes.', priceCents: 100000, durationDays: 30, durationLabel: '1 mês', active: false },
  });

  const [admin, manager, reception] = await Promise.all(
    DEMO_ACCOUNTS.map(async (u) => db.user.create({ data: { gymId: gym.id, name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) } })),
  );

  const counts = await createDemoData(db, { gym, plans, staff: [reception, reception, reception, manager], manager, notificationsEnabled: opts.notificationsEnabled });
  await db.auditLog.create({
    data: {
      gymId: gym.id,
      userId: admin.id,
      action: 'plan.update',
      entity: 'Plan',
      entityId: plans[3].id,
      summary: `${admin.name} alterou o plano Anual de 13.000 MT para 14.000 MT.`,
      before: JSON.stringify({ priceCents: 1300000 }),
      after: JSON.stringify({ priceCents: 1400000 }),
      createdAt: new Date(Date.now() - 40 * 86_400_000),
    },
  });
  return counts;
}
