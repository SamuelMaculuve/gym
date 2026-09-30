import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { PublicPaymentLink } from '@gymflow/shared';
import { env } from '../../config/env';
import { forbidden, notFound } from '../../lib/errors';
import { buildGymContext } from '../../lib/gym';
import { evaluate } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { publicLimiter } from '../../middleware/rate-limit';
import { param } from '../../middleware/validate';
import { runReminders } from '../../jobs/reminders';
import { gateways } from '../../services/payments/gateway';

export const publicRouter = Router();

/** Página pública "Pagar agora". Expõe apenas o mínimo necessário. */
publicRouter.get('/public/pay/:token', publicLimiter, async (req, res) => {
  const link = await prisma.paymentLink.findUnique({
    where: { token: param(req, 'token') },
    include: { gym: true, subscription: { include: { plan: true, member: true } } },
  });
  if (!link) throw notFound('Link de pagamento inválido');
  const ctx = buildGymContext(link.gym);
  const e = evaluate(link.subscription, ctx);
  const expired = link.expiresAt ? link.expiresAt < new Date() : false;
  const status: PublicPaymentLink['status'] = link.status === 'OPEN' && expired ? 'EXPIRED' : (link.status as PublicPaymentLink['status']);

  const response: PublicPaymentLink = {
    gymName: link.gym.name,
    gymPhone: link.gym.phone,
    gymWhatsapp: link.gym.whatsapp,
    memberName: link.subscription.member.fullName.split(' ')[0],
    memberCode: link.subscription.member.code,
    planName: link.subscription.plan.name,
    amountCents: link.amountCents,
    currency: link.gym.currency,
    dueDate: e.dueDate,
    status,
    methods: [
      ...gateways.map((g) => ({ id: g.id, label: g.label, available: g.available })),
      {
        id: 'reception',
        label: 'Pagamento na recepção',
        available: true,
        instructions: `Dirija-se à recepção e indique o número de membro ${link.subscription.member.code}.`,
      },
    ],
  };
  res.json(response);
});

/** Cron externo (ex.: Netlify Scheduled Functions, GitHub Actions): POST com cabeçalho x-cron-secret. */
publicRouter.post('/cron/reminders', async (req, res) => {
  const secret = req.get('x-cron-secret') ?? '';
  const expected = env.CRON_SECRET ?? '';
  const ok = expected.length >= 16 && secret.length === expected.length && timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!ok) throw forbidden('Segredo inválido');
  const result = await runReminders({ force: req.query.force === 'true' });
  res.json({ ...result, items: result.items.length });
});
