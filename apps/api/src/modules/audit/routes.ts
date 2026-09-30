import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { auditListQuery, type AuditLogDTO, type Role } from '@gymflow/shared';
import { prisma } from '../../lib/prisma';
import { pageMeta, parseJson } from '../../lib/utils';
import { currentUser, requirePermission } from '../../middleware/auth';
import { query } from '../../middleware/validate';

export const auditRouter = Router();

auditRouter.get('/', requirePermission('audit:read'), async (req, res) => {
  const { gymId } = currentUser(req);
  const q = query(req, auditListQuery);
  const where: Prisma.AuditLogWhereInput = {
    gymId,
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.q ? { summary: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  const items: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    user: r.user ? { ...r.user, role: r.user.role as Role } : null,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    before: parseJson(r.before, null),
    after: parseJson(r.after, null),
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));
  res.json({ items, ...pageMeta(total, q.page, q.pageSize) });
});
