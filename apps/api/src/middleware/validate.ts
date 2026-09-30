import type { Request } from 'express';
import type { z } from 'zod';
import { badRequest } from '../lib/errors';

function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw badRequest('Dados inválidos. Verifique os campos assinalados.', { fields });
  }
  return result.data;
}

export const body = <S extends z.ZodType>(req: Request, schema: S) => parse(schema, req.body);
export const query = <S extends z.ZodType>(req: Request, schema: S) => parse(schema, req.query);

/** Parâmetro de rota como string (o Express 5 tipa params como string | string[]). */
export function param(req: Request, name: string): string {
  const v = req.params[name] as string | string[] | undefined;
  return Array.isArray(v) ? v[0] : (v ?? '');
}
