// Gera uma nova migração SQL para a Netlify Database a partir das alterações ao schema.prisma.
//   DATABASE_URL=<postgres com o schema actual> npm run db:migration:new -w @gymflow/api -- add_classes
// Compara a base de dados indicada (estado actual) com o schema e escreve
// /netlify/database/migrations/<timestamp>_<nome>/migration.sql — aplicada pela Netlify no próximo deploy.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = (process.argv[2] ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
if (!name) {
  console.error('Indique o nome da migração, ex.: npm run db:migration:new -w @gymflow/api -- add_classes');
  process.exit(1);
}
const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
if (!url) {
  console.error('Defina DATABASE_URL (base de dados com o schema actual, ex.: a local do `netlify dev`).');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', join(here, '../prisma/schema.prisma'), '--script'], {
  encoding: 'utf8',
});
if (!sql.trim() || /^-- This is an empty migration/m.test(sql)) {
  console.info('Sem alterações ao schema.');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = join(here, '../../../netlify/database/migrations', `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'migration.sql'), sql);
console.info(`Migração criada: netlify/database/migrations/${stamp}_${name}/migration.sql`);
