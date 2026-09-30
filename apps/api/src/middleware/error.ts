import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Já existe um registo com estes dados.' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registo não encontrado' } });
    }
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'JSON inválido' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Ocorreu um erro interno. Tente novamente.' } });
}
