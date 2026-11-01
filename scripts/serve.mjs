import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    let relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/mistvale\//, '/');
    if (relative === '/') relative = '/index.html';
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('MISTVALE: http://127.0.0.1:4173/mistvale/'));
