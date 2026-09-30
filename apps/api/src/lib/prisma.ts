import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Ligação ao Postgres: `DATABASE_URL` (ou `NETLIFY_DB_URL`, se a Netlify Database estiver activa).
 * Sem nenhuma das duas, a API corre em **modo demonstração**: um Postgres em memória (PGlite)
 * dentro do próprio processo, semeado no arranque e guardado no Netlify Blobs (ver demo/runtime.ts).
 */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || null;
}

export const inMemoryDb = !databaseUrl();

const serverless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
let client: PrismaClient | null = null;
let clientUrl: string | null = null;
let memoryUrl: string | null = null;

function createClient(url: string, max: number) {
  const adapter = new PrismaPg({ connectionString: url, max, idleTimeoutMillis: 10_000 });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
}

function currentClient(): PrismaClient {
  if (inMemoryDb) {
    if (!memoryUrl) throw new Error('Base de dados em memória ainda não iniciada (chame ensureDatabase() primeiro).');
    // O PGlite só atende uma ligação: uma só no pool mantém as transacções isoladas.
    client ??= createClient(memoryUrl, 1);
    return client;
  }
  const url = databaseUrl()!;
  if (!client || url !== clientUrl) {
    void client?.$disconnect().catch(() => undefined);
    // Poucas ligações por instância em serverless; mais num servidor dedicado.
    client = createClient(url, Number(process.env.DB_POOL_MAX ?? (serverless ? 3 : 10)));
    clientUrl = url;
  }
  return client;
}

/** Liga o Prisma a outra base em memória (nova ou recarregada), fechando a ligação anterior. */
export async function switchMemoryDatabase(url: string) {
  const previous = client;
  client = null;
  memoryUrl = url;
  await previous?.$disconnect().catch(() => undefined);
}

/**
 * Garante que a base de dados está pronta. No modo demonstração cria-a (1.º pedido) e, na
 * Netlify, sincroniza-a com o Netlify Blobs (ver demo/runtime.ts).
 */
export async function ensureDatabase(): Promise<void> {
  if (!inMemoryDb) return;
  const { syncDemoDatabase } = await import('../demo/runtime');
  await syncDemoDatabase();
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
