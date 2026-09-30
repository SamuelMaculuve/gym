/**
 * Postgres em memória (PGlite, WebAssembly) exposto em 127.0.0.1 para o Prisma se ligar
 * como a um Postgres normal. Só para o modo demonstração: nada é gravado em disco.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { SCHEMA_SQL } from './schema.generated';

let current: { db: PGlite; server: PGLiteSocketServer } | null = null;

/**
 * Abre uma base nova: vazia (só com as tabelas) ou restaurada a partir de uma cópia.
 * Devolve o URL de ligação e uma função que fecha a base anterior (chamar depois de o
 * Prisma já estar ligado à nova).
 */
export async function openMemoryDatabase(snapshot?: Blob): Promise<{ url: string; closePrevious: () => Promise<void> }> {
  const db = snapshot ? await PGlite.create({ loadDataDir: snapshot }) : await PGlite.create();
  if (!snapshot) await db.exec(SCHEMA_SQL);
  // Porta aleatória alta: várias bases (ex.: antes/depois de recarregar) não colidem.
  for (let attempt = 0; ; attempt++) {
    const port = 40_000 + Math.floor(Math.random() * 20_000);
    const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 1 });
    try {
      await server.start();
      const previous = current;
      current = { db, server };
      return {
        url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
        closePrevious: async () => {
          await previous?.server.stop().catch(() => undefined);
          await previous?.db.close().catch(() => undefined);
        },
      };
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}

/** Cópia comprimida de toda a base (para guardar no Netlify Blobs). */
export async function snapshotMemoryDatabase(): Promise<Blob> {
  if (!current) throw new Error('Base de dados em memória não iniciada');
  return current.db.dumpDataDir('gzip');
}
