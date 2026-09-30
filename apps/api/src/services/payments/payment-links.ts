import type { Subscription } from '@prisma/client';
import { env } from '../../config/env';
import { prisma, type Tx } from '../../lib/prisma';
import { randomToken } from '../../lib/utils';

/** Obtém (ou cria) o link "Pagar agora" aberto de uma subscrição. */
export async function getOrCreatePaymentLink(sub: Subscription, tx: Tx = prisma): Promise<string> {
  const outstanding = sub.amountCents - sub.amountPaidCents;
  // Período já pago: o link serve para a renovação (valor total do plano).
  const amountCents = outstanding > 0 ? outstanding : sub.amountCents;
  const existing = await tx.paymentLink.findFirst({
    where: { subscriptionId: sub.id, status: 'OPEN', amountCents },
  });
  const link =
    existing ??
    (await tx.paymentLink.create({
      data: {
        gymId: sub.gymId,
        subscriptionId: sub.id,
        token: randomToken(18),
        amountCents,
      },
    }));
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/pay/${link.token}`;
}

/** Fecha links abertos quando a subscrição é paga ou cancelada. */
export async function closePaymentLinks(subscriptionId: string, status: 'PAID' | 'CANCELLED', tx: Tx = prisma) {
  await tx.paymentLink.updateMany({ where: { subscriptionId, status: 'OPEN' }, data: { status } });
}
