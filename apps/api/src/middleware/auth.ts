import type { NextFunction, Request, Response } from 'express';
import { ROLE_PERMISSIONS, hasPermission, type Permission, type Role } from '@gymflow/shared';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import { sha256 } from '../lib/utils';

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  gymId: string;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}

/** Valida o token Bearer e carrega o utilizador. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(unauthorized('Autenticação necessária'));

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
    return next(unauthorized());
  }

  // Actualiza "último uso" no máximo uma vez por minuto
  if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
    void prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }

  req.user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
    gymId: session.user.gymId,
    sessionId: session.id,
  };
  next();
}

/** Exige uma (ou qualquer uma de várias) permissões. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!permissions.some((p) => hasPermission(req.user!.role, p))) return next(forbidden());
    next();
  };
}

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** Utilizador autenticado (usar apenas depois de `authenticate`). */
export function currentUser(req: Request): RequestUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Dados do autor de uma operação, para audit log. */
export function actorOf(req: Request) {
  const user = currentUser(req);
  return { id: user.id, name: user.name, ip: req.ip ?? null };
}
