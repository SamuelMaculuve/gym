import type { Request } from 'express';
import { prisma, type Tx } from './prisma';

export interface AuditEntry {
  gymId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const SENSITIVE = new Set(['passwordHash', 'password', 'tokenHash', 'qrToken']);

function sanitize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (key, v) => (SENSITIVE.has(key) ? '[redacted]' : v));
}

/** Regista uma operação no audit log (dentro de uma transacção, se fornecida). */
export async function audit(entry: AuditEntry, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      gymId: entry.gymId,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: sanitize(entry.before),
      after: sanitize(entry.after),
      ip: entry.ip ?? null,
    },
  });
}

/** Devolve apenas os campos que mudaram entre dois objectos. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (after[key] !== undefined && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

export function requestIp(req: Request): string | null {
  return req.ip ?? null;
}
