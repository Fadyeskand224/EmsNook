import { isWorkKey, isIsbn, isAllowedCover } from './books.js';
import { WALLPAPERS, WOODS, LIGHTS, DECORS, FILLS, ROOM_OPTIONS, DEFAULT_SETTINGS } from '../shared/options.js';

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60;
}

export const STATUSES = ['want', 'reading', 'read'];

const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const stripCtl = (s) => s.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();

/** Validates a book chosen from search results. Returns { ok, value } with a freshly built object. */
export function validateNewBook(b) {
  try {
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('shape');
    if (!isWorkKey(b.workKey)) throw new Error('workKey');
    if (!text(b.title, 200)) throw new Error('title');
    const authors = b.authors ?? [];
    if (!Array.isArray(authors) || authors.length > 6 || !authors.every((a) => text(a, 100))) throw new Error('authors');
    if (b.coverUrl != null && !isAllowedCover(b.coverUrl)) throw new Error('cover');
    if (b.coverUrl != null && b.coverUrl.length > 300) throw new Error('cover length');
    if (b.isbn != null && !isIsbn(b.isbn)) throw new Error('isbn');
    const int = (v, lo, hi) => v == null || (Number.isInteger(v) && v >= lo && v <= hi);
    if (!int(b.pages, 1, 20000) || !int(b.year, 0, 2100)) throw new Error('numbers');
    if (b.series != null && (typeof b.series !== 'string' || b.series.length > 80)) throw new Error('series');
    if (b.seriesNo != null && !(typeof b.seriesNo === 'number' && b.seriesNo >= 0 && b.seriesNo < 1000)) throw new Error('series number');
    return {
      ok: true,
      value: {
        workKey: b.workKey,
        title: stripCtl(b.title),
        authors: authors.map(stripCtl).join(', '),
        coverUrl: b.coverUrl ?? null,
        isbn: b.isbn ?? null,
        pages: b.pages ?? null,
        year: b.year ?? null,
        series: b.series ? stripCtl(b.series).trim() || null : null,
        seriesNo: b.seriesNo ?? null,
      },
    };
  } catch {
    return { ok: false };
  }
}

/** Look-and-feel choices. Every key is optional, but anything present must be a known value. */
export function validateSettings(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return { ok: false };
  const lists = { wallpaper: WALLPAPERS, wood: WOODS, light: LIGHTS, decor: DECORS, fill: FILLS, ...ROOM_OPTIONS };
  const out = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(s)) {
    if (!(k in lists) || typeof v !== 'string' || !lists[k].includes(v)) return { ok: false };
    out[k] = v;
  }
  return { ok: true, value: out };
}

/** A list of distinct book ids, in shelf order. */
export function validateOrder(ids) {
  if (!Array.isArray(ids) || ids.length > 2000) return { ok: false };
  if (!ids.every((n) => Number.isInteger(n) && n > 0) || new Set(ids).size !== ids.length) return { ok: false };
  return { ok: true, value: ids };
}

/** Where a book stands in the 3D room: a shelf ("CASE:row:column") and how far along it, in metres. */
export function validatePlace(p) {
  if (p === null) return { ok: true, value: null };
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false };
  const { run, x } = p;
  if (typeof run !== 'string' || !/^[A-Za-z0-9]{1,4}:\d{1,2}:\d{1,2}$/.test(run)) return { ok: false };
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 12) return { ok: false };
  return { ok: true, value: { run, x: Math.round(x * 1000) / 1000 } };
}
