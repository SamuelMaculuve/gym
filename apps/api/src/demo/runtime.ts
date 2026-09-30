/**
 * Modo demonstração: a base de dados vive em memória (PGlite) e, na Netlify, é guardada no
 * Netlify Blobs para que todas as instâncias da função vejam os mesmos dados:
 *
 * - antes de cada pedido, se outra instância gravou uma versão mais recente, recarrega-a;
 * - depois de cada pedido que altera dados (POST/PATCH/DELETE…), grava a nova versão.
 *
 * Sem Netlify Blobs (ex.: `npm run dev`), fica só em memória. Para repor os dados iniciais,
 * apague a entrada no painel da Netlify (Blobs → demo-db).
 */
import { createHash, randomUUID } from 'node:crypto';
import { getStore, type Store } from '@netlify/blobs';
import { switchMemoryDatabase, prisma } from '../lib/prisma';
import { openMemoryDatabase, snapshotMemoryDatabase } from './memory-db';
import { SCHEMA_SQL } from './schema.generated';
import { seedDemo } from './seed-demo';

// Um schema diferente começa uma base nova (a cópia antiga já não serve).
const KEY = `gymflow-${createHash('sha256').update(SCHEMA_SQL).digest('hex').slice(0, 12)}`;

let store: Store | null | undefined;
let opened = false;
/** Versão (nos metadados do blob) que esta instância tem carregada. */
let loadedVersion: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

function blobStore(): Store | null {
  if (store === undefined) {
    try {
      store = getStore({ name: 'demo-db', consistency: 'strong' });
    } catch {
      store = null; // fora da Netlify
    }
  }
  return store;
}

/** Operações em série: nunca recarregar e gravar ao mesmo tempo. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function useSnapshot(snapshot?: Blob) {
  const { url, closePrevious } = await openMemoryDatabase(snapshot);
  await switchMemoryDatabase(url);
  await closePrevious();
  opened = true;
}

async function createFresh() {
  const started = Date.now();
  await useSnapshot();
  // Os telefones de demonstração podem existir: nunca enviar notificações reais.
  await seedDemo(prisma, { notificationsEnabled: false });
  console.info(`[demo] Base de demonstração criada em ${Date.now() - started} ms.`);
}

const versionOf = (metadata: Record<string, unknown> | undefined) => (typeof metadata?.version === 'string' ? metadata.version : null);

async function upload(s: Store, onlyIfNew = false) {
  const version = randomUUID();
  const res = await s.set(KEY, await snapshotMemoryDatabase(), { metadata: { version }, ...(onlyIfNew ? { onlyIfNew: true } : {}) });
  if (res.modified) loadedVersion = version;
  return res.modified;
}

/** Garante que esta instância tem a versão mais recente da base de dados. */
export function syncDemoDatabase(): Promise<void> {
  return serial(async () => {
    const s = blobStore();
    if (!s) {
      if (!opened) await createFresh();
      return;
    }
    const meta = await s.getMetadata(KEY);
    if (meta && opened && versionOf(meta.metadata) === loadedVersion) return;
    if (!meta) {
      // Primeira vez (ou dados repostos): cria, semeia e publica.
      await createFresh();
      if (await upload(s, true)) return;
      // Outra instância publicou primeiro: usa a dela.
    }
    const entry = await s.getWithMetadata(KEY, { type: 'blob' });
    if (!entry) return;
    const started = Date.now();
    await useSnapshot(entry.data);
    loadedVersion = versionOf(entry.metadata);
    console.info(`[demo] Base de dados recarregada do Netlify Blobs em ${Date.now() - started} ms.`);
  });
}

/** Grava a base de dados após um pedido que alterou dados. */
export function persistDemoDatabase(): Promise<void> {
  return serial(async () => {
    const s = blobStore();
    if (!s || !opened) return;
    // Se outra instância gravou entretanto, a última gravação prevalece (aceitável numa demo).
    const meta = await s.getMetadata(KEY);
    if (meta && versionOf(meta.metadata) !== loadedVersion) console.warn('[demo] Alteração simultânea noutra instância: prevalece esta gravação.');
    await upload(s);
  });
}
