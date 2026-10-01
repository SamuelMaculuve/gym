/**
 * Dados de demonstração: 20 membros, histórico de pagamentos, atrasos, subscrições a vencer,
 * presenças e notificações — com datas relativas a "hoje" no fuso do ginásio.
 * Tudo é inserido em lote (createMany) para caber no tempo de uma função serverless.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { Plan, Prisma } from '@prisma/client';
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
import type { Tx } from '../lib/prisma';

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
  /** Dias desde a última visita */
  absentDays?: number;
  email?: boolean;
  notificationsOff?: boolean;
  /** Recebe o contacto real de testes (DemoDataInput.contactPhone), com notificações activas. */
  contact?: boolean;
};

const SCENARIOS: Scenario[] = [
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
  { name: 'Armando Bila', gender: 'MALE', plan: 0, endOffset: 5, periods: 8, freq: 4, contact: true },
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

function prng(seedValue: number) {
  let seed = seedValue;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  return { rand, pick, between };
}

export interface DemoDataInput {
  gym: { id: string; name: string; timezone: string; currency: string; memberCodePrefix: string; memberSequence: number; receiptSequence: number };
  /** Planos na ordem Mensal, Trimestral, Semestral, Anual. */
  plans: Plan[];
  /** Funcionários que "recebem" pagamentos e registam presenças. */
  staff: { id: string; name: string }[];
  /** Quem aparece a anular o pagamento em duplicado (por omissão, o primeiro funcionário). */
  manager?: { id: string; name: string };
  /**
   * Os telefones de demonstração são fictícios mas podem existir: em produção (ex.: /setup na Netlify)
   * as notificações ficam desactivadas para nunca contactar pessoas reais.
   */
  notificationsEnabled?: boolean;
  /**
   * Telefone real para testar mensagens (E.164 sem "+"). Fica no membro de teste, que tem as
   * notificações activas mesmo quando `notificationsEnabled` é false para os restantes.
   */
  contactPhone?: string;
}

export async function createDemoData(tx: Tx, input: DemoDataInput) {
  const { gym, plans, staff } = input;
  const manager = input.manager ?? staff[0];
  const TZ = gym.timezone;
  const today = todayIn(TZ);
  const nowHour = localHour(TZ);
  const { rand, pick, between } = prng(20260930);
  const token = () => randomBytes(18).toString('base64url');

  const methodFor = (): PaymentMethod => {
    const r = rand();
    if (r < 0.4) return 'MPESA';
    if (r < 0.7) return 'CASH';
    if (r < 0.85) return 'EMOLA';
    if (r < 0.95) return 'BANK_TRANSFER';
    return 'CARD';
  };
  const referenceFor = (method: PaymentMethod) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const code = (n: number) => Array.from({ length: n }, () => pick([...chars])).join('');
    if (method === 'MPESA') return code(10);
    if (method === 'EMOLA') return `EM${code(8)}`;
    if (method === 'BANK_TRANSFER') return `TRF-${between(100000, 999999)}`;
    if (method === 'CARD') return `POS-${between(1000, 9999)}`;
    return null;
  };

  const members: Prisma.MemberCreateManyInput[] = [];
  const subscriptions: Prisma.SubscriptionCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const attendances: Prisma.AttendanceCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  const currentSub = new Map<string, { subId: string; lastPaymentDate: string | null }>();

  let memberSeq = gym.memberSequence;
  let receiptSeq = gym.receiptSequence;
  const receipt = () => `REC-${String(++receiptSeq).padStart(6, '0')}`;

  for (const [index, s] of SCENARIOS.entries()) {
    const plan = plans[s.plan];
    const memberId = randomUUID();
    const code = formatMemberCode(gym.memberCodePrefix, ++memberSeq);
    const currentEnd = addDays(today, s.endOffset);
    const currentStart = addDays(currentEnd, -(plan.durationDays - 1));
    const firstStart = addDays(currentStart, -plan.durationDays * (s.periods - 1));
    const slug = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const parts = s.name.split(' ');
    const email = s.email ? `${slug(parts[0])}.${slug(parts[parts.length - 1])}@exemplo.co.mz` : null;
    const isContact = Boolean(s.contact && input.contactPhone);
    const phone = isContact ? input.contactPhone! : `258${PREFIXES[index % PREFIXES.length]}${String(1000000 + index * 73129).slice(-7)}`;

    members.push({
      id: memberId,
      gymId: gym.id,
      code,
      qrToken: token(),
      fullName: s.name,
      phone,
      email,
      gender: s.gender,
      birthDate: addDays(today, -between(19, 48) * 365 - between(0, 364)),
      address: pick(['Sommerschield, Maputo', 'Polana Caniço, Maputo', 'Matola Rio, Matola', 'Malhangalene, Maputo', 'Alto Maé, Maputo', 'Coop, Maputo']),
      emergencyContactName: index % 3 === 0 ? 'Familiar' : null,
      emergencyContactPhone: index % 3 === 0 ? `25884${between(1000000, 9999999)}` : null,
      notes: s.suspended ? 'Subscrição suspensa por lesão no joelho (atestado médico entregue).' : null,
      joinedAt: firstStart,
      notificationsEnabled: isContact || (input.notificationsEnabled !== false && !s.notificationsOff),
    });

    let lastPaymentDate: string | null = null;
    let subId = '';
    for (let p = 0; p < s.periods; p++) {
      const startDate = addDays(firstStart, plan.durationDays * p);
      const endDate = addDays(startDate, plan.durationDays - 1);
      const isCurrent = p === s.periods - 1;
      const paid = !isCurrent || s.paidCurrent !== false;
      subId = randomUUID();
      subscriptions.push({
        id: subId,
        gymId: gym.id,
        memberId,
        planId: plan.id,
        startDate,
        endDate,
        amountCents: plan.priceCents,
        amountPaidCents: paid ? plan.priceCents : 0,
        paidAt: paid ? zonedDateTimeToInstant(startDate, '10:00', TZ) : null,
        state: isCurrent && s.suspended ? 'SUSPENDED' : 'NORMAL',
        suspendedAt: isCurrent && s.suspended ? new Date() : null,
        stateReason: isCurrent && s.suspended ? 'Lesão — atestado médico' : null,
      });
      if (paid) {
        const paymentDate = startDate > today ? today : addDays(startDate, -between(0, 1));
        const method = methodFor();
        const receivedBy = pick(staff);
        const paymentId = randomUUID();
        payments.push({
          id: paymentId,
          gymId: gym.id,
          receiptNumber: receipt(),
          memberId,
          subscriptionId: subId,
          amountCents: plan.priceCents,
          paymentDate,
          method,
          reference: referenceFor(method),
          receivedById: receivedBy.id,
          createdAt: zonedDateTimeToInstant(paymentDate, `${String(between(7, 19)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`, TZ),
        });
        if (paymentDate >= addDays(today, -20)) {
          audits.push({
            gymId: gym.id,
            userId: receivedBy.id,
            action: 'payment.create',
            entity: 'Payment',
            entityId: paymentId,
            summary: `${receivedBy.name} registou pagamento de ${formatMoney(plan.priceCents, gym.currency)} para ${code}.`,
            createdAt: zonedDateTimeToInstant(paymentDate, '10:00', TZ),
          });
        }
        if (!lastPaymentDate || paymentDate > lastPaymentDate) lastPaymentDate = paymentDate;
      }
    }
    currentSub.set(memberId, { subId, lastPaymentDate });

    // Presenças dos últimos 60 dias
    if (s.freq > 0) {
      const lastVisitAllowed = addDays(today, -(s.absentDays ?? 0));
      const since = firstStart > addDays(today, -60) ? firstStart : addDays(today, -60);
      for (let d = since; d <= lastVisitAllowed; d = addDays(d, 1)) {
        if (rand() > s.freq / 6.5) continue;
        if (d === today && nowHour < 7) continue;
        const maxHour = d === today ? Math.max(5, nowHour - 1) : 19;
        const time = `${String(between(5, maxHour)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`;
        const checkInAt = zonedDateTimeToInstant(d, time, TZ);
        attendances.push({
          gymId: gym.id,
          memberId,
          date: d,
          checkInAt,
          checkOutAt: d === today ? null : new Date(checkInAt.getTime() + between(50, 110) * 60_000),
          method: pick(['QR', 'QR', 'QR', 'CODE', 'PHONE'] as const),
          subscriptionStatus: 'ACTIVE',
          registeredById: staff[0].id,
        });
      }
    }

    // Notificações (chaves de deduplicação iguais às do motor de lembretes)
    if (s.notificationsOff) continue;
    const vars = {
      name: parts[0],
      plan: plan.name,
      amount: formatMoney(plan.priceCents, gym.currency),
      due_date: formatDate(currentEnd),
      gym_name: gym.name,
      member_code: code,
      payment_link: '',
    };
    const notify = (type: string, threshold: string | null, daysAgo: number) => {
      const channels = email ? (['WHATSAPP', 'EMAIL'] as const) : (['WHATSAPP'] as const);
      for (const channel of channels) {
        const tpl = DEFAULT_TEMPLATES.find((t) => t.type === type && t.channel === channel)!;
        const createdAt = zonedDateTimeToInstant(addDays(today, -daysAgo), '09:05', TZ);
        const failed = channel === 'EMAIL' && index === 16;
        notifications.push({
          gymId: gym.id,
          memberId,
          subscriptionId: subId,
          channel,
          type,
          recipient: channel === 'EMAIL' ? email! : phone,
          subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
          message: renderTemplate(tpl.body, vars).replace(/\n{3,}/g, '\n\n').trim(),
          status: failed ? 'FAILED' : 'SENT',
          error: failed ? 'Caixa de correio cheia (552)' : null,
          provider: 'console',
          dedupeKey: threshold ? `${subId}:${type}:${threshold}:${channel}` : null,
          sentAt: createdAt,
          createdAt,
        });
      }
    };
    if (s.periods === 1 && !s.suspended) notify('WELCOME', null, plan.durationDays - s.endOffset - 1);
    if (s.paidCurrent === false) continue;
    if (s.endOffset >= 0 && s.endOffset <= 7) {
      for (const t of [7, 3, 1].filter((t) => t >= s.endOffset)) notify('DUE_REMINDER', `before:${t}`, t - s.endOffset);
    }
    if (s.endOffset < 0) {
      const overdue = -s.endOffset;
      for (const t of [7, 3, 1]) notify('DUE_REMINDER', `before:${t}`, overdue + t);
      notify('DUE_TODAY', 'due', overdue);
      for (const t of [1, 7, 14].filter((t) => t <= overdue)) notify('OVERDUE', `overdue:${t}`, overdue - t);
    }
  }

  // Um pagamento em duplicado, estornado, para mostrar o histórico preservado
  const old = payments.find((p) => (p.paymentDate as string) < addDays(today, -60));
  if (old) {
    const id = randomUUID();
    payments.push({
      ...old,
      id,
      receiptNumber: receipt(),
      method: 'CASH',
      reference: null,
      status: 'REFUNDED',
      cancelReason: 'Pagamento registado em duplicado',
      cancelledAt: new Date(),
      cancelledById: manager.id,
    });
    const code = members.find((m) => m.id === old.memberId)!.code;
    audits.push({
      gymId: gym.id,
      userId: manager.id,
      action: 'payment.refund',
      entity: 'Payment',
      entityId: id,
      summary: `${manager.name} estornou um pagamento de ${formatMoney(old.amountCents, gym.currency)} (${code}): Pagamento registado em duplicado`,
      before: JSON.stringify({ status: 'PAID' }),
      after: JSON.stringify({ status: 'REFUNDED' }),
      createdAt: zonedDateTimeToInstant(old.paymentDate as string, '16:20', TZ),
    });
  }

  await tx.member.createMany({ data: members });
  await tx.subscription.createMany({ data: subscriptions });
  await tx.payment.createMany({ data: payments });
  await tx.attendance.createMany({ data: attendances });
  await tx.notification.createMany({ data: notifications });
  await tx.auditLog.createMany({ data: audits });
  // Campos desnormalizados: um UPDATE por membro (20)
  await Promise.all(
    [...currentSub.entries()].map(([id, v]) => tx.member.update({ where: { id }, data: { currentSubscriptionId: v.subId, lastPaymentDate: v.lastPaymentDate } })),
  );
  await tx.gym.update({ where: { id: gym.id }, data: { memberSequence: memberSeq, receiptSequence: receiptSeq } });

  return { members: members.length, payments: payments.length, attendances: attendances.length, notifications: notifications.length };
}
