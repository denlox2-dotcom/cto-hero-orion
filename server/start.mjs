import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLeaderboardApi } from './leaderboard.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const api = createLeaderboardApi();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = createServer((req, res) => api.handler(req, res, async () => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end(); }
}));
const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`CTO на страже инфраструктуры: http://${host}:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => { api.close(); process.exit(0); }));
