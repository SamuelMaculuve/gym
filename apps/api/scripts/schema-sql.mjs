// Gera src/demo/schema.generated.ts com o SQL que cria todas as tabelas a partir do schema.prisma.
// Usado pela base de dados em memória (modo demonstração). Correr após alterar o schema:
//   npm run db:schema-sql -w @gymflow/api
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sql = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', join(here, '../prisma/schema.prisma'), '--script'], {
  encoding: 'utf8',
});
const out = join(here, '../src/demo/schema.generated.ts');
writeFileSync(out, `// Gerado por scripts/schema-sql.mjs — não editar à mão.\nexport const SCHEMA_SQL = ${JSON.stringify(sql)};\n`);
console.info('SQL do schema escrito em src/demo/schema.generated.ts');
