/**
 * Postgres em memória (PGlite, WebAssembly) exposto em 127.0.0.1 para o Prisma se ligar
 * como a um Postgres normal. Só para o modo demonstração: nada é gravado em disco.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { SCHEMA_SQL } from './schema.generated';

export async function startMemoryDatabase(): Promise<string> {
  const db = await PGlite.create();
  await db.exec(SCHEMA_SQL);
  // Porta aleatória alta: várias instâncias (ex.: API e testes) não colidem.
  for (let attempt = 0; ; attempt++) {
    const port = 40_000 + Math.floor(Math.random() * 20_000);
    const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 1 });
    try {
      await server.start();
      return `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}
