/**
 * Dados de demonstração para desenvolvimento local.
 *
 *   npm run db:seed    (apaga todos os dados e volta a semear)
 *
 * Na Netlify, use o assistente /setup com "Incluir dados de demonstração".
 */
import { inMemoryDb, prisma } from '../src/lib/prisma';
import { DEMO_ACCOUNTS, seedDemo } from '../src/demo/seed-demo';

async function main() {
  if (inMemoryDb) throw new Error('Defina DATABASE_URL no .env (sem ela a API já arranca com dados de demonstração em memória).');
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

  const counts = await seedDemo(prisma);
  console.info('✅ Seed concluído:', counts);
  console.info(`
Contas de demonstração:
${DEMO_ACCOUNTS.map((u) => `  ${u.role.padEnd(13)} ${u.email.padEnd(30)} ${u.password}`).join('\n')}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
