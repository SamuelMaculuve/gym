// Empacota as Netlify Functions (netlify/functions/*.mts) em JavaScript pronto a correr,
// com o código de @gymflow/shared (TypeScript) incluído. A Netlify publica o resultado
// (netlify/functions-built) sem ter de compilar pacotes TypeScript do monorepo.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'netlify/functions');
const out = join(root, 'netlify/functions-built');

// Carregados do disco em runtime (motor do Prisma, ficheiros .wasm do PGlite): ficam em node_modules.
const external = ['@prisma/client', '.prisma', '@prisma/adapter-pg', 'pg', '@electric-sql/pglite', '@electric-sql/pglite-socket'];

rmSync(out, { recursive: true, force: true });
const entryPoints = readdirSync(src).filter((f) => f.endsWith('.mts')).map((f) => join(src, f));

await build({
  entryPoints,
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  // Dependências CommonJS (Express, etc.) usam require() dentro do bundle ESM.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'warning',
});
console.log(`Funções empacotadas em netlify/functions-built: ${entryPoints.map((e) => e.split('/').pop()).join(', ')}`);
