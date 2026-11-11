import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || (prod ? '0.0.0.0' : '127.0.0.1');

// Database: a hosted Turso database in production, or a local SQLite file for development.
let dbConfig;
if (process.env.TURSO_DATABASE_URL) {
  dbConfig = { url: process.env.TURSO_DATABASE_URL.trim(), authToken: (process.env.TURSO_AUTH_TOKEN || '').trim() };
} else {
  // A local file only survives if the disk does. Hosts like Render wipe it on every restart.
  if (prod && !process.env.DATA_DIR) {
    console.error('Refusing to start: set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN), or DATA_DIR pointing at a persistent disk.');
    process.exit(1);
  }
  const dataDir = process.env.DATA_DIR || path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  dbConfig = { url: `file:${path.join(dataDir, 'emsnook.db')}` };
}
let db;
try {
  db = await openDb(dbConfig);
} catch (e) {
  console.error(`Startup failed: ${e.message}`);
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!prod) allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');

const app = createApp({ db, prod, distDir: path.join(root, 'dist'), allowedOrigins });
setInterval(() => app.locals.sessions.prune().catch(() => {}), 60 * 60e3).unref();

const server = app.listen(port, host, () => console.log(`EmsNook listening on ${host}:${port} (${prod ? 'production' : 'development'})`));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
}
