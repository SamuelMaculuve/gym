/**
 * Dados de demonstração para desenvolvimento local.
 *
 *   npm run db:seed    (apaga todos os dados e volta a semear)
 *
 * Na Netlify, use o assistente /setup com "Incluir dados de demonstração".
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createDemoData } from '../src/demo/demo-data';
import { createGymWithDefaults } from '../src/modules/setup/bootstrap';

async function main() {
  console.info('A semear dados de demonstração...');

  // Limpa na ordem das dependências
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationTemplate.deleteMany(),
    prisma.paymentLink.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.member.updateMany({ data: { currentSubscriptionId: null } }),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.member.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.session.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
    prisma.gym.deleteMany(),
  ]);

  const { gym, plans } = await createGymWithDefaults(prisma, {
    name: 'Força Total Fitness',
    phone: '258841000100',
    whatsapp: '258841000100',
    email: 'geral@forcatotal.co.mz',
    address: 'Av. Julius Nyerere, 1234 — Maputo',
  });
  await prisma.plan.create({
    data: { gymId: gym.id, name: 'Estudante (descontinuado)', description: 'Plano antigo para estudantes.', priceCents: 100000, durationDays: 30, durationLabel: '1 mês', active: false },
  });

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const users = [
    { name: 'Administrador', email: 'admin@gymflow.co.mz', role: 'ADMIN', password: 'Admin@2026' },
    { name: 'Marta Sitoe', email: 'gestor@gymflow.co.mz', role: 'MANAGER', password: 'Gestor@2026' },
    { name: 'Samuel Cossa', email: 'recepcao@gymflow.co.mz', role: 'RECEPTIONIST', password: 'Recepcao@2026' },
    { name: 'Helena Tembe', email: 'contabilidade@gymflow.co.mz', role: 'ACCOUNTANT', password: 'Conta@2026' },
  ];
  const [admin, manager, reception] = await Promise.all(
    users.map((u) => prisma.user.create({ data: { gymId: gym.id, name: u.name, email: u.email, role: u.role, passwordHash: hash(u.password) } })),
  );

  const counts = await createDemoData(prisma, { gym, plans, staff: [reception, reception, reception, manager], manager });
  await prisma.auditLog.create({
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

  console.info('✅ Seed concluído:', counts);
  console.info(`
Contas de demonstração:
${users.map((u) => `  ${u.role.padEnd(13)} ${u.email.padEnd(30)} ${u.password}`).join('\n')}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
