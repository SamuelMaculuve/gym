/**
 * API do GymFlow como Netlify Function (formato v2), servida em /api/* no mesmo domínio do
 * site — sem CORS nem VITE_API_URL em produção.
 * Base de dados: DATABASE_URL; sem ela, corre em modo demonstração (Postgres em memória
 * guardado no Netlify Blobs, ver apps/api/src/demo/runtime.ts).
 */
import serverless from 'serverless-http';
import { createApp } from '../../apps/api/src/app';
import { inMemoryDb } from '../../apps/api/src/lib/prisma';

/** O que usamos do contexto das Netlify Functions (v2). */
type Context = { ip?: string };

const express = serverless(createApp());
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const query: Record<string, string[]> = {};
  url.searchParams.forEach((v, k) => (query[k] ??= []).push(v));
  const headers = Object.fromEntries(req.headers);
  if (context.ip && !headers['x-forwarded-for']) headers['x-forwarded-for'] = context.ip;
  const body = READ_ONLY.has(req.method) ? null : Buffer.from(await req.arrayBuffer());

  // O Express corre através do adaptador Lambda (serverless-http).
  const res = (await express(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers,
      multiValueQueryStringParameters: Object.keys(query).length ? query : null,
      body: body?.length ? body.toString('base64') : null,
      isBase64Encoded: true,
      requestContext: { identity: { sourceIp: context.ip } },
    },
    {},
  )) as { statusCode: number; headers?: Record<string, string>; multiValueHeaders?: Record<string, string[]>; body: string; isBase64Encoded?: boolean };

  // Modo demonstração: grava a base antes de responder, para o pedido seguinte (noutra instância) já a ver.
  if (inMemoryDb && !READ_ONLY.has(req.method) && res.statusCode < 400) {
    const { persistDemoDatabase } = await import('../../apps/api/src/demo/runtime');
    await persistDemoDatabase().catch((e) => console.error('[demo] Falha ao gravar no Netlify Blobs', e));
  }

  const out = new Headers();
  for (const [k, v] of Object.entries(res.headers ?? {})) out.set(k, String(v));
  for (const [k, vs] of Object.entries(res.multiValueHeaders ?? {})) for (const v of vs) out.append(k, String(v));
  const payload = res.isBase64Encoded ? Buffer.from(res.body, 'base64') : res.body;
  return new Response(res.statusCode === 204 || res.statusCode === 304 ? null : payload, { status: res.statusCode, headers: out });
};

export const config = { path: '/api/*' };
