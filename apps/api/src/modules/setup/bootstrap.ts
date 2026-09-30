import type { Plan } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '@gymflow/shared';
import { DEFAULT_REMINDER_SETTINGS } from '../../lib/gym';
import type { Tx } from '../../lib/prisma';

export const DEFAULT_PLANS = [
  { name: 'Mensal', description: 'Acesso livre à sala de musculação e aulas de grupo durante 1 mês.', priceCents: 150000, durationDays: 30, durationLabel: '1 mês' },
  { name: 'Trimestral', description: 'Três meses de treino com poupança face ao plano mensal.', priceCents: 400000, durationDays: 90, durationLabel: '3 meses' },
  { name: 'Semestral', description: 'Seis meses de acesso completo. Inclui avaliação física.', priceCents: 750000, durationDays: 180, durationLabel: '6 meses' },
  { name: 'Anual', description: 'Um ano de acesso completo com o melhor preço.', priceCents: 1400000, durationDays: 365, durationLabel: '12 meses' },
];

export interface GymBootstrapInput {
  name: string;
  currency?: string;
  timezone?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  createDefaultPlans?: boolean;
}

/** Cria um ginásio com as configurações, templates e (opcionalmente) planos padrão. */
export async function createGymWithDefaults(tx: Tx, input: GymBootstrapInput): Promise<{ gym: Awaited<ReturnType<Tx['gym']['create']>>; plans: Plan[] }> {
  const gym = await tx.gym.create({
    data: {
      name: input.name,
      currency: input.currency ?? 'MZN',
      timezone: input.timezone ?? 'Africa/Maputo',
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      whatsapp: input.whatsapp ?? null,
      notificationSettings: JSON.stringify(DEFAULT_REMINDER_SETTINGS),
    },
  });
  await tx.notificationTemplate.createMany({
    data: DEFAULT_TEMPLATES.filter((t) => t.type !== 'PASSWORD_RESET').map((t) => ({ gymId: gym.id, type: t.type, channel: t.channel, subject: t.subject, body: t.body })),
  });
  let plans: Plan[] = [];
  if (input.createDefaultPlans !== false) {
    await tx.plan.createMany({ data: DEFAULT_PLANS.map((p) => ({ gymId: gym.id, ...p })) });
    plans = await tx.plan.findMany({ where: { gymId: gym.id }, orderBy: { durationDays: 'asc' } });
  }
  return { gym, plans };
}

/** Contas de demonstração (mesmas do seed local). Palavras-passe conhecidas: alterar após testes. */
export const DEMO_USERS = [
  { name: 'Marta Sitoe', email: 'gestor@gymflow.co.mz', role: 'MANAGER', password: 'Gestor@2026' },
  { name: 'Samuel Cossa', email: 'recepcao@gymflow.co.mz', role: 'RECEPTIONIST', password: 'Recepcao@2026' },
  { name: 'Helena Tembe', email: 'contabilidade@gymflow.co.mz', role: 'ACCOUNTANT', password: 'Conta@2026' },
] as const;
