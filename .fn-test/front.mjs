import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const DIST = new URL('../apps/web/dist/', import.meta.url).pathname;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let n = 0; const hits = { 4201: 0, 4202: 0 };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const port = n++ % 2 ? 4202 : 4201; hits[port]++;
    const up = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(up); return;
  }
  if (req.url === '/__hits') { res.end(JSON.stringify(hits)); return; }
  const path = req.url.split('?')[0];
  try { const f = await readFile(join(DIST, path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(f); }
  catch { res.writeHead(200, { 'content-type': 'text/html' }); res.end(await readFile(join(DIST, 'index.html'))); }
}).listen(4200, () => console.log('front em 4200'));
