import { createClient } from '@libsql/client';
import { rewardFor } from '../shared/items.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY,
     email         TEXT NOT NULL UNIQUE,
     name          TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at    INTEGER NOT NULL
   )`,
  // Only a SHA-256 of the session token is stored, never the token itself.
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id    INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     last_used  INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
  // Failed-attempt counters for lockout. Keys are hashed, so no emails are stored here.
  `CREATE TABLE IF NOT EXISTS attempts (
     key          TEXT PRIMARY KEY,
     count        INTEGER NOT NULL,
     first_at     INTEGER NOT NULL,
     locked_until INTEGER NOT NULL
   )`,
  // Password-reset links: only a SHA-256 of the token is stored; each works once and expires after an hour.
  `CREATE TABLE IF NOT EXISTS resets (
     token_hash TEXT PRIMARY KEY,
     user_id    INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS resets_user ON resets(user_id)',
  // Coins: one entry per book a reader has finished (a book earns once, even if removed and added again).
  `CREATE TABLE IF NOT EXISTS coin_log (
     user_id  INTEGER NOT NULL,
     work_key TEXT NOT NULL,
     amount   INTEGER NOT NULL,
     at       INTEGER NOT NULL,
     PRIMARY KEY (user_id, work_key)
   )`,
  // What a reader has bought: placed is null while it is in the box, or JSON {x,y,z,ry,s} once it stands in the library.
  `CREATE TABLE IF NOT EXISTS items (
     id        INTEGER PRIMARY KEY,
     user_id   INTEGER NOT NULL,
     kind      TEXT NOT NULL,
     price     INTEGER NOT NULL,
     placed    TEXT,
     bought_at INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS items_user ON items(user_id)',
  // Every book a user has saved: status is want (to read), reading, or read.
  `CREATE TABLE IF NOT EXISTS books (
     id           INTEGER PRIMARY KEY,
     user_id      INTEGER NOT NULL,
     work_key     TEXT NOT NULL,
     title        TEXT NOT NULL,
     authors      TEXT NOT NULL DEFAULT '',
     cover_url    TEXT,
     isbn         TEXT,
     pages        INTEGER,
     year         INTEGER,
     description  TEXT,
     subjects     TEXT,
     rating       REAL,
     rating_count INTEGER,
     rating_source TEXT,
     checked_at   INTEGER,
     status       TEXT NOT NULL CHECK (status IN ('want', 'reading', 'read')),
     my_rating    INTEGER,
     added_at     INTEGER NOT NULL,
     started_at   INTEGER,
     finished_at  INTEGER,
     UNIQUE (user_id, work_key)
   )`,
  'CREATE INDEX IF NOT EXISTS books_user ON books(user_id, status)',
  // A reader's own photo of a book's spine, shown on their shelf in place of the generated one.
  `CREATE TABLE IF NOT EXISTS spines (
     book_id    INTEGER PRIMARY KEY,
     user_id    INTEGER NOT NULL,
     mime       TEXT NOT NULL,
     data       BLOB NOT NULL,
     w          INTEGER NOT NULL,
     h          INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS spines_user ON spines(user_id)',
  // The reading diary: one row each time a reader updates the page they are on.
  `CREATE TABLE IF NOT EXISTS reading_log (
     id      INTEGER PRIMARY KEY,
     book_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     page    INTEGER NOT NULL,
     delta   INTEGER NOT NULL,
     at      INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS reading_log_book ON reading_log(book_id, at)',
  // One row of look-and-feel choices per reader (wallpaper, wood, lighting, decorations).
  `CREATE TABLE IF NOT EXISTS settings (
     user_id    INTEGER PRIMARY KEY,
     json       TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  // Cached lookups from Open Library / Google Books, so repeat views are instant and we stay polite to free services.
  `CREATE TABLE IF NOT EXISTS book_cache (
     key        TEXT PRIMARY KEY,
     json       TEXT NOT NULL,
     fetched_at INTEGER NOT NULL
   )`,
];

/**
 * Opens a libSQL database: a local file / ':memory:' for development and tests, or a
 * hosted Turso database (libsql://...) in production. Small async helpers keep call sites tidy.
 */
export async function openDb({ url, authToken } = {}) {
  const client = createClient({ url, authToken });

  try {
    await client.execute('SELECT 1');
  } catch (e) {
    throw new Error(`Database connection check failed (${e.code || 'error'}: ${e.message}). Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.`);
  }
  for (const [i, stmt] of SCHEMA.entries()) {
    try {
      await client.execute(stmt);
    } catch (e) {
      throw new Error(`Database setup failed on schema statement ${i + 1}/${SCHEMA.length} (${e.code || 'error'}: ${e.message}).`);
    }
  }

  // Databases created before drag-to-reorder get the shelf position column in place.
  const bookCols = (await client.execute('PRAGMA table_info(books)')).rows.map((r) => r.name);
  if (!bookCols.includes('shelf_pos')) await client.execute('ALTER TABLE books ADD COLUMN shelf_pos INTEGER');

  if (!bookCols.includes('current_page')) await client.execute('ALTER TABLE books ADD COLUMN current_page INTEGER NOT NULL DEFAULT 0');

  if (!bookCols.includes('place')) await client.execute('ALTER TABLE books ADD COLUMN place TEXT');

  if (!bookCols.includes('series')) {
    await client.execute('ALTER TABLE books ADD COLUMN series TEXT');
    await client.execute('ALTER TABLE books ADD COLUMN series_no REAL');
    await client.execute('ALTER TABLE books ADD COLUMN series_checked INTEGER');
  }

  if (!bookCols.includes('thick')) {
    await client.execute('ALTER TABLE books ADD COLUMN thick REAL');
    await client.execute('ALTER TABLE books ADD COLUMN tall REAL');
  }

  // Readers who finished books before coins existed are paid for them once.
  const owed = await client.execute("SELECT user_id, work_key, pages FROM books WHERE status = 'read' AND NOT EXISTS (SELECT 1 FROM coin_log c WHERE c.user_id = books.user_id AND c.work_key = books.work_key)");
  for (const r of owed.rows) {
    const amount = rewardFor(Number(r.pages));
    await client.execute({ sql: 'INSERT OR IGNORE INTO coin_log (user_id, work_key, amount, at) VALUES (?, ?, ?, ?)', args: [r.user_id, r.work_key, amount, Date.now()] });
  }

  const rowsOf = (r) => r.rows.map((row) => Object.fromEntries(r.columns.map((c) => [c, row[c]])));

  return {
    async get(sql, args = []) {
      return rowsOf(await client.execute({ sql, args }))[0];
    },
    async all(sql, args = []) {
      return rowsOf(await client.execute({ sql, args }));
    },
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
    },
    /** Runs several statements atomically: batch([[sql, args], ...]). */
    batch(statements) {
      return client.batch(statements.map(([sql, args = []]) => ({ sql, args })), 'write');
    },
    close: () => client.close(),
  };
}
