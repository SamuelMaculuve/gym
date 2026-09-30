import { getConnectionString } from '@netlify/database';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Ligação ao Postgres. Na Netlify usa `NETLIFY_DB_URL` (Netlify Database), que pode mudar
 * entre invocações — o cliente é recriado quando isso acontece. Fora da Netlify usa `DATABASE_URL`.
 */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    // Lê NETLIFY_DB_URL do ambiente da Netlify (funções, builds e `netlify dev`).
    return getConnectionString();
  } catch {
    throw new Error('Base de dados não configurada: defina DATABASE_URL ou use a Netlify Database (netlify dev / deploy).');
  }
}

const serverless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
let client: PrismaClient | null = null;
let clientUrl: string | null = null;

function currentClient(): PrismaClient {
  const url = databaseUrl();
  if (!client || url !== clientUrl) {
    void client?.$disconnect().catch(() => undefined);
    const adapter = new PrismaPg({
      connectionString: url,
      // Poucas ligações por instância em serverless; mais num servidor dedicado.
      max: Number(process.env.DB_POOL_MAX ?? (serverless ? 3 : 10)),
      idleTimeoutMillis: 10_000,
    });
    client = new PrismaClient({ adapter, log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
    clientUrl = url;
  }
  return client;
}

/** Cliente Prisma partilhado (proxy para a ligação actual). */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = currentClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
