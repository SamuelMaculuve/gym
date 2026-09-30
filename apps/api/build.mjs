// Empacota a API (incluindo @gymflow/shared) num único ficheiro para produção.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  // O pacote partilhado é código-fonte TypeScript: tem de ser incluído no bundle.
  plugins: [
    {
      name: 'bundle-shared',
      setup(b) {
        b.onResolve({ filter: /^@gymflow\/shared$/ }, async (args) => {
          const r = await b.resolve('../../packages/shared/src/index.ts', { resolveDir: args.resolveDir, kind: 'import-statement' });
          return { path: r.path };
        });
      },
    },
  ],
});
console.log('API compilada em dist/server.js');
