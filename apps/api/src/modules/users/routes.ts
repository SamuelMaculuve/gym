import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { ROLE_LABELS, userCreateSchema, userResetPasswordSchema, userUpdateSchema, type Role, type UserDTO } from '@gymflow/shared';
import { audit, diff } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { currentUser, requirePermission } from '../../middleware/auth';
import { body, param } from '../../middleware/validate';

export const usersRouter = Router();
usersRouter.use(requirePermission('users:manage'));

const toUserDTO = (u: User): UserDTO => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
  active: u.active,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

usersRouter.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ where: { gymId: currentUser(req).gymId }, orderBy: { name: 'asc' } });
  res.json(users.map(toUserDTO));
});

usersRouter.post('/', async (req, res) => {
  const actor = currentUser(req);
  const input = body(req, userCreateSchema);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict('Já existe um utilizador com este email');
  const user = await prisma.user.create({
    data: { gymId: actor.gymId, name: input.name, email: input.email, role: input.role, passwordHash: await bcrypt.hash(input.password, 12) },
  });
  await audit({
    gymId: actor.gymId,
    userId: actor.id,
    action: 'user.create',
    entity: 'User',
    entityId: user.id,
    summary: `${actor.name} criou o utilizador ${user.name} (${ROLE_LABELS[input.role]}).`,
    after: toUserDTO(user),
    ip: req.ip,
  });
  res.status(201).json(toUserDTO(user));
});

usersRouter.patch('/:id', async (req, res) => {
  const actor = currentUser(req);
  const input = body(req, userUpdateSchema);
  const user = await prisma.user.findFirst({ where: { id: param(req, 'id'), gymId: actor.gymId } });
  if (!user) throw notFound('Utilizador não encontrado');

  const demotingAdmin = user.role === 'ADMIN' && ((input.role && input.role !== 'ADMIN') || input.active === false);
  if (demotingAdmin) {
    const admins = await prisma.user.count({ where: { gymId: actor.gymId, role: 'ADMIN', active: true } });
    if (admins <= 1) throw badRequest('Tem de existir pelo menos um administrador activo');
  }
  if (user.id === actor.id && input.active === false) throw badRequest('Não pode desactivar a sua própria conta');

  const changes = diff(user as unknown as Record<string, unknown>, input);
  const updated = await prisma.user.update({ where: { id: user.id }, data: input });
  if (input.active === false) await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (changes.changed.length) {
    await audit({
      gymId: actor.gymId,
      userId: actor.id,
      action: 'user.update',
      entity: 'User',
      entityId: user.id,
      summary: `${actor.name} actualizou o utilizador ${user.name}${input.role && input.role !== user.role ? ` (perfil: ${ROLE_LABELS[input.role]})` : ''}.`,
      before: changes.before,
      after: changes.after,
      ip: req.ip,
    });
  }
  res.json(toUserDTO(updated));
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const actor = currentUser(req);
  const { password } = body(req, userResetPasswordSchema);
  const user = await prisma.user.findFirst({ where: { id: param(req, 'id'), gymId: actor.gymId } });
  if (!user) throw notFound('Utilizador não encontrado');
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ gymId: actor.gymId, userId: actor.id, action: 'user.reset_password', entity: 'User', entityId: user.id, summary: `${actor.name} redefiniu a palavra-passe de ${user.name}.`, ip: req.ip });
  res.status(204).end();
});
