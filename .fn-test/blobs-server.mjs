import { BlobsServer } from '@netlify/blobs/server';
const server = new BlobsServer({ directory: new URL('./blobs', import.meta.url).pathname, port: 45001, token: 'tok' });
await server.start();
console.log('blobs server ready');
