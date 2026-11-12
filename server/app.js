import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword, dummyVerify, passwordProblem } from './passwords.js';
import { createSessionStore, SESSION_DAYS } from './sessions.js';
import { createAttemptTracker } from './attempts.js';
import { validateEmail, validateName, validateNewBook, validateSettings, validateOrder, validatePlace, STATUSES } from './validate.js';
import { DEFAULT_SETTINGS } from '../shared/options.js';
import { createBookLookup, normIsbn, UpstreamError } from './books.js';

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';
const LOCKED_ERROR = 'Too many attempts. Please wait a few minutes and try again.';
const MAX_BOOKS = 2000;
// Every book query joins the spine photo's size and version (never its bytes).
const BOOKS_Q = 'SELECT b.*, s.w AS spine_w, s.h AS spine_h, s.updated_at AS spine_v FROM books b LEFT JOIN spines s ON s.book_id = b.id';
const SPINE_TYPES = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': null };
const looksLike = (buf, mime) => {
  if (mime === 'image/webp') return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return SPINE_TYPES[mime].every((b, i) => buf[i] === b);
};

const toBook = (r) => ({
  id: r.id,
  workKey: r.work_key,
  title: r.title,
  authors: r.authors ? r.authors.split(', ') : [],
  coverUrl: r.cover_url,
  isbn: r.isbn,
  pages: r.pages,
  currentPage: r.current_page ?? 0,
  series: r.series ?? null,
  seriesNo: r.series_no ?? null,
  place: r.place ? JSON.parse(r.place) : null,
  thick: r.thick ?? null,
  tall: r.tall ?? null,
  year: r.year,
  description: r.description,
  subjects: r.subjects ? JSON.parse(r.subjects) : [],
  rating: r.rating,
  ratingCount: r.rating_count,
  ratingSource: r.rating_source,
  checked: !!r.checked_at,
  status: r.status,
  shelfPos: r.shelf_pos,
  spineW: r.spine_w ?? null,
  spineH: r.spine_h ?? null,
  spineV: r.spine_v ?? null,
  myRating: r.my_rating,
  addedAt: r.added_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

export function createApp({ db, prod = false, distDir = null, allowedOrigins = [], limits = {}, fetchImpl, googleKey } = {}) {
  const app = express();
  const sessions = createSessionStore(db);
  const loginAttempts = createAttemptTracker(db, { scope: 'login' });
  const passwordAttempts = createAttemptTracker(db, { scope: 'password' });
  const lookup = createBookLookup({ db, fetchImpl, googleKey });

  const COOKIE = prod ? '__Host-sid' : 'sid'; // __Host- pins the cookie to this exact host over HTTPS
  const cookieOpts = { httpOnly: true, secure: prod, sameSite: 'lax', path: '/' };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.sessions = sessions;

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          // Book covers come from Open Library (which redirects to archive.org) and Google Books.
          imgSrc: ["'self'", 'data:', 'https://covers.openlibrary.org', 'https://*.archive.org', 'https://books.google.com', 'https://*.googleusercontent.com'],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: prod ? { maxAge: 63072000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    })
  );

  // The camera is for the barcode scanner on our own pages only; everything else a page could ask for is off.
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    next();
  });

  const api = express.Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: '32kb' }));

  // CSRF defence in depth (on top of SameSite=Lax): state-changing requests must come from our own origin.
  api.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    const self = `${req.protocol}://${req.get('host')}`;
    if (origin ? origin === self || allowedOrigins.includes(origin) : req.get('sec-fetch-site') === 'same-origin') return next();
    return res.status(403).json({ error: 'Forbidden.' });
  });

  const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: LOCKED_ERROR } });
  const authLimiter = limiter(15 * 60e3, limits.auth ?? 30);
  const signupLimiter = limiter(60 * 60e3, limits.signup ?? 10);
  const searchLimiter = limiter(10 * 60e3, limits.search ?? 200);
  api.use(limiter(15 * 60e3, limits.general ?? 900));

  const readCookie = (req) => {
    for (const part of (req.get('cookie') || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) {
        try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; } // a mangled cookie is just not a session
      }
    }
    return null;
  };
  const setSession = async (res, userId) => {
    const token = await sessions.create(userId);
    res.cookie(COOKIE, token, { ...cookieOpts, maxAge: SESSION_DAYS * 86400000 });
  };
  const clearSession = (res) => res.clearCookie(COOKIE, cookieOpts);
  const h = (fn) => (req, res, next) => fn(req, res, next).catch(next); // Express 4 doesn't catch rejected promises

  const requireAuth = h(async (req, res, next) => {
    const token = readCookie(req);
    const s = token && (await sessions.get(token));
    if (!s) return res.status(401).json({ error: 'Please log in.' });
    req.user = s.user;
    req.token = token;
    return next();
  });

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
  const normEmail = (e) => String(e).trim().toLowerCase();

  api.get('/health', (req, res) => res.json({ ok: true }));

  // ───────── Auth ─────────
  api.post('/auth/signup', signupLimiter, h(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!validateName(name)) return res.status(400).json({ error: 'Please enter your name.' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const id = normEmail(email);
    const problem = passwordProblem(password, { email: id, name });
    if (problem) return res.status(400).json({ error: problem });
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', [id])) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    try {
      const info = await db.run(
        'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [id, name.trim(), await hashPassword(password), Date.now()]
      );
      await setSession(res, info.lastInsertRowid);
      return res.status(201).json({ user: { id: info.lastInsertRowid, name: name.trim(), email: id } });
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'An account with that email already exists.' });
      throw e;
    }
  }));

  api.post('/auth/login', authLimiter, h(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) {
      return res.status(400).json({ error: GENERIC_LOGIN_ERROR });
    }
    const id = normEmail(email);
    if (await loginAttempts.isLocked(id)) return res.status(429).json({ error: LOCKED_ERROR });

    const user = await db.get('SELECT * FROM users WHERE email = ?', [id]);
    const ok = user ? await verifyPassword(password, user.password_hash) : await dummyVerify(password);
    if (!ok) {
      await loginAttempts.fail(id);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }
    await loginAttempts.reset(id);
    await setSession(res, user.id); // brand-new token on every login
    return res.json({ user: publicUser(user) });
  }));

  api.post('/auth/logout', h(async (req, res) => {
    const token = readCookie(req);
    if (token) await sessions.destroy(token);
    clearSession(res);
    res.json({ ok: true });
  }));

  api.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  // Data portability: everything we hold about you, as a download. Never includes the password hash.
  api.get('/auth/export', requireAuth, h(async (req, res) => {
    const account = await db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    const books = await db.all(`${BOOKS_Q} WHERE b.user_id = ? ORDER BY b.added_at`, [req.user.id]);
    const prefs = await db.get('SELECT json FROM settings WHERE user_id = ?', [req.user.id]);
    res.set('Content-Disposition', 'attachment; filename="emsnook-my-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      account: { id: account.id, name: account.name, email: account.email, createdAt: new Date(account.created_at).toISOString() },
      settings: prefs ? JSON.parse(prefs.json) : null,
      books: books.map(toBook),
    });
  }));

  api.post('/auth/password', requireAuth, h(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const key = `pw:${req.user.id}`;
    if (await passwordAttempts.isLocked(key)) return res.status(429).json({ error: LOCKED_ERROR });
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, row.password_hash))) {
      await passwordAttempts.fail(key);
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }
    await passwordAttempts.reset(key);
    const problem = passwordProblem(newPassword, { email: req.user.email, name: req.user.name });
    if (problem) return res.status(400).json({ error: problem });
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), req.user.id]);
    await sessions.destroyAllForUser(req.user.id); // signs out every other device
    await setSession(res, req.user.id);
    return res.json({ ok: true });
  }));

  api.delete('/auth/account', requireAuth, h(async (req, res) => {
    const key = `pw:${req.user.id}`;
    if (await passwordAttempts.isLocked(key)) return res.status(429).json({ error: LOCKED_ERROR });
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const password = typeof (req.body || {}).password === 'string' ? req.body.password : '';
    if (!password || !(await verifyPassword(password, row.password_hash))) {
      await passwordAttempts.fail(key);
      return res.status(401).json({ error: 'Your password is incorrect.' });
    }
    await db.batch([
      ['DELETE FROM sessions WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM spines WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM reading_log WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM books WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM settings WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM users WHERE id = ?', [req.user.id]],
    ]);
    clearSession(res);
    return res.json({ ok: true });
  }));

  // ───────── Book search ─────────
  api.get('/books/search', requireAuth, searchLimiter, h(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    try {
      return res.json({ results: await lookup.search(q) });
    } catch (e) {
      if (e instanceof UpstreamError) return res.status(502).json({ error: 'The book catalog is unavailable right now. Please try again in a moment.' });
      throw e;
    }
  }));

  // A scanned barcode: the ISBN under it, looked up in the catalog. The reader confirms before anything is added.
  api.get('/books/isbn/:isbn', requireAuth, searchLimiter, h(async (req, res) => {
    if (!normIsbn(req.params.isbn)) return res.status(400).json({ error: 'That is not a valid ISBN.' });
    try {
      const result = await lookup.byIsbn(req.params.isbn);
      if (!result) return res.status(404).json({ error: 'The catalog does not know that barcode yet.' });
      res.json({ result });
    } catch (e) {
      if (e instanceof UpstreamError) return res.status(502).json({ error: 'The book catalog is unavailable right now. Please try again in a moment.' });
      throw e;
    }
  }));

  // ───────── Your library ─────────
  /** Fills in blurb, subjects and fan rating from the catalog sources; never throws. */
  async function enrich(row) {
    try {
      const d = await lookup.details({ workKey: row.work_key, isbn: row.isbn, title: row.title, author: row.authors.split(', ')[0] });
      await db.run(
        `UPDATE books SET description = ?, subjects = ?, rating = ?, rating_count = ?, rating_source = ?,
                pages = COALESCE(pages, ?), checked_at = ?,
                series = COALESCE(series, ?), series_no = COALESCE(series_no, ?) WHERE id = ?`,
        [d.description || null, JSON.stringify(d.subjects || []), d.rating, d.ratingCount, d.ratingSource, d.pages, Date.now(), d.series || null, d.seriesNo ?? null, row.id]
      );
    } catch { /* leave the book as saved; the app retries on open */ }
    return db.get(`${BOOKS_Q} WHERE b.id = ?`, [row.id]);
  }

  const idOf = (req) => (/^\d{1,12}$/.test(req.params.id) ? Number(req.params.id) : null);
  const owned = (req, id) => db.get(`${BOOKS_Q} WHERE b.id = ? AND b.user_id = ?`, [id, req.user.id]);

  api.get('/library', requireAuth, h(async (req, res) => {
    const rows = await db.all(`${BOOKS_Q} WHERE b.user_id = ? ORDER BY b.added_at DESC`, [req.user.id]);
    res.json({ books: rows.map(toBook) });
  }));

  api.post('/library', requireAuth, h(async (req, res) => {
    const { book, status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Choose want, reading or read.' });
    const v = validateNewBook(book);
    if (!v.ok) return res.status(400).json({ error: 'That book could not be saved.' });
    const b = v.value;
    const existing = await db.get('SELECT id FROM books WHERE user_id = ? AND work_key = ?', [req.user.id, b.workKey]);
    if (existing) return res.status(409).json({ error: 'That book is already in your nook.' });
    const count = await db.get('SELECT COUNT(*) AS n FROM books WHERE user_id = ?', [req.user.id]);
    if (count.n >= MAX_BOOKS) return res.status(400).json({ error: 'Your nook is full.' });
    const now = Date.now();
    const info = await db.run(
      `INSERT INTO books (user_id, work_key, title, authors, cover_url, isbn, pages, year, status, added_at, started_at, finished_at, series, series_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, b.workKey, b.title, b.authors, b.coverUrl, b.isbn, b.pages, b.year, status, now,
        status === 'want' ? null : now, status === 'read' ? now : null, b.series, b.seriesNo]
    );
    const row = await enrich(await db.get(`${BOOKS_Q} WHERE b.id = ?`, [info.lastInsertRowid]));
    res.status(201).json({ book: toBook(row) });
  }));

  api.patch('/library/:id', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    const { status, myRating, currentPage, pages, place, thick, tall } = req.body || {};
    const sets = [];
    const args = [];
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Choose want, reading or read.' });
      const now = Date.now();
      sets.push('status = ?');
      args.push(status);
      if (status === 'want') sets.push('started_at = NULL', 'finished_at = NULL');
      if (status === 'reading') { sets.push('finished_at = NULL'); if (!row.started_at) { sets.push('started_at = ?'); args.push(now); } }
      if (status === 'read') { sets.push('finished_at = ?'); args.push(now); if (!row.started_at) { sets.push('started_at = ?'); args.push(now); } }
    }
    if (myRating !== undefined) {
      if (myRating !== null && !(Number.isInteger(myRating) && myRating >= 1 && myRating <= 5)) return res.status(400).json({ error: 'Rate from 1 to 5.' });
      sets.push('my_rating = ?');
      args.push(myRating);
    }
    // How fat and how tall the book stands on the shelf, as multiples of its normal size (null puts it back to normal).
    for (const [key, col, lo, hi] of [[thick, 'thick', 0.5, 2.2], [tall, 'tall', 0.6, 1.25]]) {
      if (key === undefined) continue;
      if (key !== null && !(typeof key === 'number' && Number.isFinite(key) && key >= lo && key <= hi)) return res.status(400).json({ error: 'That size is not available.' });
      sets.push(`${col} = ?`);
      args.push(key === null ? null : Math.round(key * 100) / 100);
    }
    if (place !== undefined) {
      const v = validatePlace(place);
      if (!v.ok) return res.status(400).json({ error: 'That spot on the shelf is not valid.' });
      sets.push('place = ?');
      args.push(v.value ? JSON.stringify(v.value) : null);
    }
    // Reading progress. The total can be corrected by the reader (editions differ); the page can never pass it.
    let total = row.pages;
    let page = row.current_page ?? 0;
    if (pages !== undefined) {
      if (!(Number.isInteger(pages) && pages >= 1 && pages <= 20000)) return res.status(400).json({ error: 'Enter the number of pages in the book.' });
      total = pages;
      sets.push('pages = ?');
      args.push(pages);
      if (page > total) page = total;
    }
    if (currentPage !== undefined) {
      if (!(Number.isInteger(currentPage) && currentPage >= 0 && currentPage <= (total || 20000))) {
        return res.status(400).json({ error: total ? `Enter a page from 0 to ${total}.` : 'Enter a page number.' });
      }
      page = currentPage;
    }
    if (status === 'read' && total) page = total;
    if (status === 'want') page = 0;
    if (page !== (row.current_page ?? 0)) {
      sets.push('current_page = ?');
      args.push(page);
      if (currentPage !== undefined && status === undefined) {
        await db.run('INSERT INTO reading_log (book_id, user_id, page, delta, at) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, page, page - (row.current_page ?? 0), Date.now()]);
        if (row.status === 'want') { sets.push("status = 'reading'"); if (!row.started_at) { sets.push('started_at = ?'); args.push(Date.now()); } }
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to change.' });
    await db.run(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, [...args, id]);
    res.json({ book: toBook(await owned(req, id)) });
  }));

  // Works out series for books that have not been checked yet, so shelves can be arranged by series.
  api.post('/library/series', requireAuth, h(async (req, res) => {
    const rows = await db.all(`${BOOKS_Q} WHERE b.user_id = ? AND (b.series_checked IS NULL)`, [req.user.id]);
    for (const r of rows.slice(0, 30)) {
      let found = { series: r.series, seriesNo: r.series_no };
      if (!found.series) {
        try { found = await lookup.seriesFor({ isbn: r.isbn, title: r.title, subjects: r.subjects ? JSON.parse(r.subjects) : [] }); } catch { /* title and subjects only */ }
      }
      await db.run('UPDATE books SET series = COALESCE(series, ?), series_no = COALESCE(series_no, ?), series_checked = ? WHERE id = ?', [found.series || null, found.seriesNo ?? null, Date.now(), r.id]);
    }
    const all = await db.all(`${BOOKS_Q} WHERE b.user_id = ? ORDER BY b.added_at DESC`, [req.user.id]);
    res.json({ books: all.map(toBook), remaining: Math.max(0, rows.length - 30) });
  }));

  // Where the reader's books stand in the 3D room, saved in one go (used when new books are first put on a shelf).
  api.put('/library/places', requireAuth, h(async (req, res) => {
    const list = (req.body || {}).places;
    if (!Array.isArray(list) || list.length > 500) return res.status(400).json({ error: 'Nothing to place.' });
    const stmts = [];
    for (const it of list) {
      const v = validatePlace({ run: it?.run, x: it?.x });
      if (!v.ok || !Number.isInteger(it.id) || it.id < 1) return res.status(400).json({ error: 'That spot on the shelf is not valid.' });
      stmts.push(['UPDATE books SET place = ? WHERE id = ? AND user_id = ?', [JSON.stringify(v.value), it.id, req.user.id]]);
    }
    if (stmts.length) await db.batch(stmts);
    res.json({ ok: true });
  }));

  // Drag-to-reorder: the client sends every shelved book id in the order it now stands.
  api.put('/library/order', requireAuth, h(async (req, res) => {
    const v = validateOrder((req.body || {}).ids);
    if (!v.ok) return res.status(400).json({ error: 'That order could not be saved.' });
    if (v.value.length) {
      await db.batch(v.value.map((id, i) => ['UPDATE books SET shelf_pos = ? WHERE id = ? AND user_id = ?', [i, id, req.user.id]]));
    }
    res.json({ ok: true });
  }));

  // ───────── Look and feel ─────────
  api.get('/settings', requireAuth, h(async (req, res) => {
    const row = await db.get('SELECT json FROM settings WHERE user_id = ?', [req.user.id]);
    res.json({ settings: row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.json) } : DEFAULT_SETTINGS });
  }));

  api.put('/settings', requireAuth, h(async (req, res) => {
    const v = validateSettings((req.body || {}).settings);
    if (!v.ok) return res.status(400).json({ error: 'Those settings are not available.' });
    await db.run(
      `INSERT INTO settings (user_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      [req.user.id, JSON.stringify(v.value), Date.now()]
    );
    res.json({ settings: v.value });
  }));

  // ───────── Your own photo of a spine ─────────
  api.put('/library/:id/spine', requireAuth, express.raw({ type: Object.keys(SPINE_TYPES), limit: '400kb' }), h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    const mime = req.get('content-type');
    const w = Number(req.get('x-image-width'));
    const hgt = Number(req.get('x-image-height'));
    const ok = Buffer.isBuffer(req.body) && req.body.length > 100 && SPINE_TYPES[mime] !== undefined && looksLike(req.body, mime)
      && Number.isInteger(w) && Number.isInteger(hgt) && w >= 20 && hgt >= 60 && w <= 2000 && hgt <= 4000 && hgt / w >= 1.5 && hgt / w <= 20;
    if (!ok) return res.status(400).json({ error: 'That photo could not be used. Try another one.' });
    await db.run(
      `INSERT INTO spines (book_id, user_id, mime, data, w, h, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, w = excluded.w, h = excluded.h, updated_at = excluded.updated_at`,
      [id, req.user.id, mime, req.body, w, hgt, Date.now()]
    );
    res.json({ book: toBook(await owned(req, id)) });
  }));

  // The diary for one book, oldest first (the client works out pace, streaks and the finish estimate from it).
  api.get('/library/:id/log', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    const rows = await db.all('SELECT page, delta, at FROM reading_log WHERE book_id = ? AND user_id = ? ORDER BY at DESC, id DESC LIMIT 400', [id, req.user.id]);
    res.json({ log: rows.reverse().map((r) => ({ page: r.page, delta: r.delta, at: r.at })) });
  }));

  api.get('/library/:id/spine', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await db.get('SELECT mime, data FROM spines WHERE book_id = ? AND user_id = ?', [id, req.user.id]));
    if (!row) return res.status(404).json({ error: 'No spine photo.' });
    res.set({ 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=31536000, immutable' });
    res.send(Buffer.from(row.data));
  }));

  api.delete('/library/:id/spine', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    await db.run('DELETE FROM spines WHERE book_id = ?', [id]);
    res.json({ book: toBook(await owned(req, id)) });
  }));

  api.post('/library/:id/refresh', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    res.json({ book: toBook(await enrich(row)) });
  }));

  api.delete('/library/:id', requireAuth, h(async (req, res) => {
    const id = idOf(req);
    const row = id && (await owned(req, id));
    if (!row) return res.status(404).json({ error: 'Book not found.' });
    await db.batch([['DELETE FROM spines WHERE book_id = ?', [id]], ['DELETE FROM reading_log WHERE book_id = ?', [id]], ['DELETE FROM books WHERE id = ?', [id]]]);
    res.json({ ok: true });
  }));

  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use('/api', api);

  // Error handler: never leak internals.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Bad request.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  // ───────── Static app (production) ─────────
  if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, file) {
          if (/index\.html$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}
