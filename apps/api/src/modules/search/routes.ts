import { Router } from 'express';
import { hasPermission, type SearchResults } from '@gymflow/shared';
import { getGymContext } from '../../lib/gym';
import { memberRefSelect, toMemberRef } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { normalizeSearch } from '../../lib/utils';
import { currentUser, requirePermission } from '../../middleware/auth';
import { loadMembersWithStatus } from '../members/service';

export const searchRouter = Router();

/** Pesquisa global: nome, telefone, email, número de membro e referência de pagamento. */
searchRouter.get('/', requirePermission('members:read', 'payments:read'), async (req, res) => {
  const user = currentUser(req);
  const term = String(req.query.q ?? '').trim();
  const results: SearchResults = { members: [], payments: [] };
  if (term.length < 2) return res.json(results);

  const ctx = await getGymContext(user.gymId);
  const n = normalizeSearch(term);
  const digits = term.replace(/\D/g, '');

  if (hasPermission(user.role, 'members:read')) {
    const members = await loadMembersWithStatus(ctx);
    results.members = members
      .map((m) => m.item)
      .filter(
        (m) =>
          normalizeSearch(`${m.fullName} ${m.code} ${m.email ?? ''}`).includes(n) || (digits.length >= 3 && m.phone.includes(digits)),
      )
      .slice(0, 8)
      .map((m) => ({ id: m.id, code: m.code, fullName: m.fullName, phone: m.phone, email: m.email, status: m.status }));
  }

  if (hasPermission(user.role, 'payments:read')) {
    const payments = await prisma.payment.findMany({
      where: {
        gymId: user.gymId,
        OR: [{ reference: { contains: term, mode: 'insensitive' } }, { receiptNumber: { contains: term.toUpperCase(), mode: 'insensitive' } }],
      },
      include: { member: { select: memberRefSelect } },
      orderBy: { paymentDate: 'desc' },
      take: 6,
    });
    results.payments = payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      reference: p.reference,
      amountCents: p.amountCents,
      paymentDate: p.paymentDate,
      method: p.method as SearchResults['payments'][number]['method'],
      member: toMemberRef(p.member),
    }));
  }
  res.json(results);
});
