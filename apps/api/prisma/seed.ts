/**
 * Dados de demonstração: 20 membros, 4 planos, histórico de pagamentos, atrasos,
 * subscrições a vencer, presenças e notificações. Datas relativas a "hoje" no fuso do ginásio.
 *
 *   npm run db:setup     (cria a base de dados e corre este seed)
 *   npm run db:reset     (apaga tudo e volta a semear)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  addDays,
  DEFAULT_TEMPLATES,
  formatDate,
  formatMemberCode,
  formatMoney,
  localHour,
  renderTemplate,
  todayIn,
  zonedDateTimeToInstant,
  type PaymentMethod,
} from '@gymflow/shared';

const prisma = new PrismaClient();
const TZ = 'Africa/Maputo';
const today = todayIn(TZ);
const token = (n = 18) => randomBytes(n).toString('base64url');

// PRNG determinístico para dados reprodutíveis
let seed = 20260930;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

function randomMethod(): PaymentMethod {
  const r = rand();
  if (r < 0.4) return 'MPESA';
  if (r < 0.7) return 'CASH';
  if (r < 0.85) return 'EMOLA';
  if (r < 0.95) return 'BANK_TRANSFER';
  return 'CARD';
}

function referenceFor(method: PaymentMethod) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const code = (n: number) => Array.from({ length: n }, () => pick([...chars])).join('');
  if (method === 'MPESA') return code(10);
  if (method === 'EMOLA') return `EM${code(8)}`;
  if (method === 'BANK_TRANSFER') return `TRF-${between(100000, 999999)}`;
  if (method === 'CARD') return `POS-${between(1000, 9999)}`;
  return null;
}

type Scenario = {
  name: string;
  gender: 'MALE' | 'FEMALE';
  plan: 0 | 1 | 2 | 3;
  /** Fim do período actual, relativo a hoje */
  endOffset: number;
  /** Número de períodos (incluindo o actual) */
  periods: number;
  paidCurrent?: boolean;
  suspended?: boolean;
  /** Frequência semanal de treino (0 = não treina) */
  freq: number;
  /** Dias desde a última visita (para "não frequentam há 7+ dias") */
  absentDays?: number;
  email?: boolean;
  notificationsOff?: boolean;
};

const scenarios: Scenario[] = [
  // Activos, em dia
  { name: 'Ana Paula Machava', gender: 'FEMALE', plan: 0, endOffset: 18, periods: 9, freq: 4, email: true },
  { name: 'Carlos Alberto Sitoe', gender: 'MALE', plan: 1, endOffset: 51, periods: 4, freq: 5, email: true },
  { name: 'Fátima Nhantumbo', gender: 'FEMALE', plan: 3, endOffset: 210, periods: 2, freq: 3, email: true },
  { name: 'Edson Cumbe', gender: 'MALE', plan: 0, endOffset: 25, periods: 5, freq: 5 },
  { name: 'Luísa Tembe', gender: 'FEMALE', plan: 2, endOffset: 96, periods: 2, freq: 3, email: true },
  { name: 'Hélder Mabunda', gender: 'MALE', plan: 0, endOffset: 12, periods: 11, freq: 2, absentDays: 12 },
  { name: 'Joana Chissano', gender: 'FEMALE', plan: 1, endOffset: 33, periods: 3, freq: 4, email: true },
  { name: 'Nelson Matsinhe', gender: 'MALE', plan: 0, endOffset: 9, periods: 7, freq: 3, absentDays: 9 },
  // Novos este mês (Dércio inscreveu-se mas ainda não pagou)
  { name: 'Yolanda Macuácua', gender: 'FEMALE', plan: 0, endOffset: 27, periods: 1, freq: 4, email: true },
  { name: 'Dércio Langa', gender: 'MALE', plan: 1, endOffset: 86, periods: 1, freq: 0, paidCurrent: false },
  // A vencer nos próximos 7 dias
  { name: 'Célia Munguambe', gender: 'FEMALE', plan: 0, endOffset: 2, periods: 6, freq: 3, email: true },
  { name: 'Armando Bila', gender: 'MALE', plan: 0, endOffset: 5, periods: 8, freq: 4 },
  { name: 'Graça Mondlane', gender: 'FEMALE', plan: 1, endOffset: 7, periods: 2, freq: 2, email: true },
  // Vencem hoje
  { name: 'Ivone Cossa', gender: 'FEMALE', plan: 0, endOffset: 0, periods: 4, freq: 3, email: true },
  { name: 'Mário Zandamela', gender: 'MALE', plan: 0, endOffset: 0, periods: 10, freq: 5 },
  // Em atraso
  { name: 'Paulo Nhaca', gender: 'MALE', plan: 0, endOffset: -1, periods: 5, freq: 3, email: true },
  { name: 'Sónia Mahumane', gender: 'FEMALE', plan: 0, endOffset: -8, periods: 3, freq: 2, absentDays: 8 },
  { name: 'Tomás Guambe', gender: 'MALE', plan: 1, endOffset: -15, periods: 2, freq: 1, absentDays: 15, email: true },
  // Expirado
  { name: 'Rosa Manhiça', gender: 'FEMALE', plan: 0, endOffset: -45, periods: 3, freq: 0, email: true, notificationsOff: true },
  // Suspenso (lesão)
  { name: 'Vasco Ubisse', gender: 'MALE', plan: 2, endOffset: 60, periods: 1, freq: 0, suspended: true },
];

const PREFIXES = ['84', '85', '86', '87', '82', '83'];

async function main() {
  console.info(`A semear dados de demonstração (hoje = ${today}, ${TZ})...`);

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

  const gym = await prisma.gym.create({
    data: {
      name: 'Força Total Fitness',
      phone: '258841000100',
      email: 'geral@forcatotal.co.mz',
      whatsapp: '258841000100',
      address: 'Av. Julius Nyerere, 1234 — Maputo',
      currency: 'MZN',
      timezone: TZ,
      openingDays: '[1,2,3,4,5,6]',
      openingTime: '05:30',
      closingTime: '21:00',
      notificationSettings: JSON.stringify({
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
      }),
    },
  });

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const [admin, manager, reception] = await Promise.all([
    prisma.user.create({ data: { gymId: gym.id, name: 'Administrador', email: 'admin@gymflow.co.mz', role: 'ADMIN', passwordHash: hash('Admin@2026') } }),
    prisma.user.create({ data: { gymId: gym.id, name: 'Marta Sitoe', email: 'gestor@gymflow.co.mz', role: 'MANAGER', passwordHash: hash('Gestor@2026') } }),
    prisma.user.create({ data: { gymId: gym.id, name: 'Samuel Cossa', email: 'recepcao@gymflow.co.mz', role: 'RECEPTIONIST', passwordHash: hash('Recepcao@2026') } }),
    prisma.user.create({ data: { gymId: gym.id, name: 'Helena Tembe', email: 'contabilidade@gymflow.co.mz', role: 'ACCOUNTANT', passwordHash: hash('Conta@2026') } }),
  ]);
  const staff = [reception, reception, reception, manager];

  const plans = await Promise.all(
    [
      { name: 'Mensal', description: 'Acesso livre à sala de musculação e aulas de grupo durante 1 mês.', priceCents: 150000, durationDays: 30, durationLabel: '1 mês' },
      { name: 'Trimestral', description: 'Três meses de treino com poupança face ao plano mensal.', priceCents: 400000, durationDays: 90, durationLabel: '3 meses' },
      { name: 'Semestral', description: 'Seis meses de acesso completo. Inclui avaliação física.', priceCents: 750000, durationDays: 180, durationLabel: '6 meses' },
      { name: 'Anual', description: 'Um ano de acesso completo com o melhor preço.', priceCents: 1400000, durationDays: 365, durationLabel: '12 meses' },
    ].map((p) => prisma.plan.create({ data: { gymId: gym.id, ...p } })),
  );
  await prisma.plan.create({
    data: { gymId: gym.id, name: 'Estudante (descontinuado)', description: 'Plano antigo para estudantes.', priceCents: 100000, durationDays: 30, durationLabel: '1 mês', active: false },
  });

  await prisma.notificationTemplate.createMany({
    data: DEFAULT_TEMPLATES.filter((t) => t.type !== 'PASSWORD_RESET').map((t) => ({ gymId: gym.id, type: t.type, channel: t.channel, subject: t.subject, body: t.body })),
  });

  let receiptSeq = 0;
  const nowHour = localHour(TZ);
  const allPayments: { id: string; memberCode: string; amountCents: number; paymentDate: string; receivedBy: string }[] = [];

  for (const [index, s] of scenarios.entries()) {
    const plan = plans[s.plan];
    const code = formatMemberCode(gym.memberCodePrefix, index + 1);
    const currentEnd = addDays(today, s.endOffset);
    const currentStart = addDays(currentEnd, -(plan.durationDays - 1));
    const firstStart = addDays(currentStart, -plan.durationDays * (s.periods - 1));
    const first = s.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const last = s.name.split(' ').slice(-1)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        code,
        qrToken: token(),
        fullName: s.name,
        phone: `258${PREFIXES[index % PREFIXES.length]}${String(1000000 + index * 73129).slice(-7)}`,
        email: s.email ? `${first}.${last}@exemplo.co.mz` : null,
        gender: s.gender,
        birthDate: addDays(today, -between(19, 48) * 365 - between(0, 364)),
        address: pick(['Sommerschield, Maputo', 'Polana Caniço, Maputo', 'Matola Rio, Matola', 'Malhangalene, Maputo', 'Alto Maé, Maputo', 'Coop, Maputo']),
        emergencyContactName: index % 3 === 0 ? 'Familiar' : null,
        emergencyContactPhone: index % 3 === 0 ? `25884${between(1000000, 9999999)}` : null,
        notes: s.suspended ? 'Subscrição suspensa por lesão no joelho (atestado médico entregue).' : null,
        joinedAt: firstStart,
        notificationsEnabled: !s.notificationsOff,
      },
    });

    let currentSubId = '';
    let lastPaymentDate: string | null = null;
    for (let p = 0; p < s.periods; p++) {
      const startDate = addDays(firstStart, plan.durationDays * p);
      const endDate = addDays(startDate, plan.durationDays - 1);
      const isCurrent = p === s.periods - 1;
      const paid = !isCurrent || s.paidCurrent !== false;

      const sub = await prisma.subscription.create({
        data: {
          gymId: gym.id,
          memberId: member.id,
          planId: plan.id,
          startDate,
          endDate,
          amountCents: plan.priceCents,
          amountPaidCents: paid ? plan.priceCents : 0,
          paidAt: paid ? zonedDateTimeToInstant(startDate, '10:00', TZ) : null,
          state: isCurrent && s.suspended ? 'SUSPENDED' : 'NORMAL',
          suspendedAt: isCurrent && s.suspended ? new Date() : null,
          stateReason: isCurrent && s.suspended ? 'Lesão — atestado médico' : null,
        },
      });
      if (isCurrent) currentSubId = sub.id;

      if (paid) {
        const paymentDate = startDate > today ? today : addDays(startDate, -between(0, 1));
        const method = randomMethod();
        const receivedBy = pick(staff);
        receiptSeq++;
        const payment = await prisma.payment.create({
          data: {
            gymId: gym.id,
            receiptNumber: `REC-${String(receiptSeq).padStart(6, '0')}`,
            memberId: member.id,
            subscriptionId: sub.id,
            amountCents: plan.priceCents,
            paymentDate,
            method,
            reference: referenceFor(method),
            receivedById: receivedBy.id,
            createdAt: zonedDateTimeToInstant(paymentDate, `${String(between(7, 19)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`, TZ),
          },
        });
        allPayments.push({ id: payment.id, memberCode: code, amountCents: plan.priceCents, paymentDate, receivedBy: receivedBy.name });
        if (!lastPaymentDate || paymentDate > lastPaymentDate) lastPaymentDate = paymentDate;
      }
    }

    await prisma.member.update({ where: { id: member.id }, data: { currentSubscriptionId: currentSubId, lastPaymentDate } });

    // Presenças dos últimos 60 dias
    if (s.freq > 0) {
      const lastVisitAllowed = addDays(today, -(s.absentDays ?? 0));
      const since = firstStart > addDays(today, -60) ? firstStart : addDays(today, -60);
      const rows = [];
      for (let d = since; d <= lastVisitAllowed; d = addDays(d, 1)) {
        if (rand() > s.freq / 6.5) continue;
        if (d === today && nowHour < 7) continue;
        const maxHour = d === today ? Math.max(5, nowHour - 1) : 19;
        const hour = between(5, maxHour);
        const time = `${String(hour).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`;
        const checkInAt = zonedDateTimeToInstant(d, time, TZ);
        rows.push({
          gymId: gym.id,
          memberId: member.id,
          date: d,
          checkInAt,
          checkOutAt: d === today ? null : new Date(checkInAt.getTime() + between(50, 110) * 60_000),
          method: pick(['QR', 'QR', 'QR', 'CODE', 'PHONE'] as const),
          subscriptionStatus: 'ACTIVE',
          registeredById: reception.id,
        });
      }
      if (rows.length) await prisma.attendance.createMany({ data: rows });
    }

    // Notificações (coerentes com as chaves de deduplicação do motor de lembretes)
    const vars = {
      name: s.name.split(' ')[0],
      plan: plan.name,
      amount: formatMoney(plan.priceCents, gym.currency),
      due_date: formatDate(currentEnd),
      gym_name: gym.name,
      member_code: code,
      payment_link: '',
    };
    const notify = async (type: string, threshold: string | null, daysAgo: number) => {
      const channels = s.email ? (['WHATSAPP', 'EMAIL'] as const) : (['WHATSAPP'] as const);
      for (const channel of channels) {
        const tpl = DEFAULT_TEMPLATES.find((t) => t.type === type && t.channel === channel)!;
        const createdAt = zonedDateTimeToInstant(addDays(today, -daysAgo), '09:05', TZ);
        await prisma.notification.create({
          data: {
            gymId: gym.id,
            memberId: member.id,
            subscriptionId: currentSubId,
            channel,
            type,
            recipient: channel === 'EMAIL' ? member.email! : member.phone,
            subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
            message: renderTemplate(tpl.body, vars).replace(/\n{3,}/g, '\n\n').trim(),
            status: channel === 'EMAIL' && index === 16 ? 'FAILED' : 'SENT',
            error: channel === 'EMAIL' && index === 16 ? 'Caixa de correio cheia (552)' : null,
            provider: 'console',
            dedupeKey: threshold ? `${currentSubId}:${type}:${threshold}:${channel}` : null,
            sentAt: createdAt,
            createdAt,
          },
        });
      }
    };

    if (s.notificationsOff) continue;
    if (s.periods === 1 && !s.suspended) await notify('WELCOME', null, plan.durationDays - s.endOffset - 1);
    if (s.paidCurrent === false) continue;
    if (s.endOffset >= 0 && s.endOffset <= 7) {
      for (const t of [7, 3, 1].filter((t) => t >= s.endOffset)) await notify('DUE_REMINDER', `before:${t}`, t - s.endOffset);
    }
    if (s.endOffset < 0) {
      const overdue = -s.endOffset;
      for (const t of [7, 3, 1]) await notify('DUE_REMINDER', `before:${t}`, overdue + t);
      await notify('DUE_TODAY', 'due', overdue);
      for (const t of [1, 7, 14].filter((t) => t <= overdue)) await notify('OVERDUE', `overdue:${t}`, overdue - t);
    }
  }

  await prisma.gym.update({ where: { id: gym.id }, data: { memberSequence: scenarios.length, receiptSequence: receiptSeq } });

  // Um estorno para demonstrar o histórico preservado
  const refundTarget = allPayments.find((p) => p.paymentDate < addDays(today, -60));
  if (refundTarget) {
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: refundTarget.id } });
    receiptSeq++;
    const dup = await prisma.payment.create({
      data: {
        gymId: gym.id,
        receiptNumber: `REC-${String(receiptSeq).padStart(6, '0')}`,
        memberId: p.memberId,
        subscriptionId: p.subscriptionId,
        amountCents: p.amountCents,
        paymentDate: p.paymentDate,
        method: 'CASH',
        status: 'REFUNDED',
        cancelReason: 'Pagamento registado em duplicado',
        cancelledAt: new Date(),
        cancelledById: manager.id,
        receivedById: reception.id,
      },
    });
    await prisma.gym.update({ where: { id: gym.id }, data: { receiptSequence: receiptSeq } });
    await prisma.auditLog.create({
      data: {
        gymId: gym.id,
        userId: manager.id,
        action: 'payment.refund',
        entity: 'Payment',
        entityId: dup.id,
        summary: `${manager.name} estornou o pagamento ${dup.receiptNumber} de ${formatMoney(dup.amountCents)} (${refundTarget.memberCode}): Pagamento registado em duplicado`,
        before: JSON.stringify({ status: 'PAID' }),
        after: JSON.stringify({ status: 'REFUNDED' }),
        createdAt: zonedDateTimeToInstant(p.paymentDate, '16:20', TZ),
      },
    });
  }

  // Audit log de exemplo
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
      createdAt: zonedDateTimeToInstant(addDays(today, -40), '11:12', TZ),
    },
  });
  for (const p of allPayments.filter((x) => x.paymentDate >= addDays(today, -20))) {
    await prisma.auditLog.create({
      data: {
        gymId: gym.id,
        userId: p.receivedBy === reception.name ? reception.id : manager.id,
        action: 'payment.create',
        entity: 'Payment',
        entityId: p.id,
        summary: `${p.receivedBy} registou pagamento de ${formatMoney(p.amountCents)} para ${p.memberCode}.`,
        createdAt: zonedDateTimeToInstant(p.paymentDate, '10:00', TZ),
      },
    });
  }

  const counts = {
    membros: await prisma.member.count(),
    planos: await prisma.plan.count(),
    pagamentos: await prisma.payment.count(),
    presencas: await prisma.attendance.count(),
    notificacoes: await prisma.notification.count(),
  };
  console.info('✅ Seed concluído:', counts);
  console.info(`
Contas de demonstração:
  Administrador  admin@gymflow.co.mz          Admin@2026
  Gestor         gestor@gymflow.co.mz         Gestor@2026
  Recepção       recepcao@gymflow.co.mz       Recepcao@2026
  Contabilidade  contabilidade@gymflow.co.mz  Conta@2026
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
