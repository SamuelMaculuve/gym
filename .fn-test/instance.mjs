import http from 'node:http';
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: 'http://127.0.0.1:45001', uncachedEdgeURL: 'http://127.0.0.1:45001', siteID: 'site', token: 'tok', deployID: 'd1' })).toString('base64');
const { default: fn } = await import('./api.mjs');
const port = Number(process.argv[2]);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await fn(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET','HEAD'].includes(req.method) ? undefined : body }), { ip: '127.0.0.1' });
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`instância em ${port}`));
