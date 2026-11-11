// Book data comes from Open Library (free, no key) and, when GOOGLE_BOOKS_API_KEY is set, Google Books.
// Results are cached in the database. Fan ratings from the sources are combined into one weighted score.

const OL = 'https://openlibrary.org';
const UA = 'EmsNook/0.1 (book reading app)';
const DAY = 86400000;

export class UpstreamError extends Error {}

export const isWorkKey = (k) => typeof k === 'string' && /^OL\d{1,12}W$/.test(k);
export const isIsbn = (s) => typeof s === 'string' && /^(\d{9}[\dX]|\d{13})$/.test(s);

/** Any ISBN-10 or ISBN-13 as printed (hyphens and spaces allowed) to a valid ISBN-13, or null. */
export function normIsbn(raw) {
  const d = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(d)) {
    const sum = [...d].slice(0, 12).reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(d[12]) && /^97[89]/.test(d) ? d : null;
  }
  if (/^\d{9}[\dX]$/.test(d)) {
    const sum = [...d].reduce((n, c, i) => n + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11 !== 0) return null;
    const core = `978${d.slice(0, 9)}`;
    const s13 = [...core].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return core + ((10 - (s13 % 10)) % 10);
  }
  return null;
}

/**
 * Finds out which series a book belongs to and where it falls in it, from what the catalog says
 * (an edition's "series" lines, a "series:..." subject) or from the title, "(Name, #3)" style.
 */
export function detectSeries({ title = '', subjects = [], editionSeries = [] } = {}) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 1000 ? n : null; };
  const nameOf = (v) => clean(v, 80).replace(/[,;:\s-]+$/g, '').trim();
  // publishers' imprints and study guides are "series" in the catalog, but not the kind readers shelve together
  const imprint = /spark ?notes|cliffs? ?notes|study guide|literature guide|penguin|oxford|signet|norton|classics|everyman|vintage|bantam|dover|wordsworth|modern library|library of america|great books|bloom|barnes|puffin|scholastic|bestsellers|paperback|pocket|the new york times/i;
  const ok = (r) => (r.series && imprint.test(r.series) ? { series: null, seriesNo: null } : r);
  for (const line of editionSeries) {
    const m = String(line).match(/^(.*?)[\s,;:(#]+(?:book|vol(?:ume)?\.?|no\.?|part|#)?\s*(\d{1,3}(?:\.\d)?)\s*\)?\s*$/i);
    if (m && nameOf(m[1]).length > 1 && !ok({ series: nameOf(m[1]) }).series === false) { const r = ok({ series: nameOf(m[1]), seriesNo: num(m[2]) }); if (r.series) return r; continue; }
    if (nameOf(line).length > 1) { const r = ok({ series: nameOf(line), seriesNo: null }); if (r.series) return r; }
  }
  const t = String(title).match(/\(([^()]{2,80}?)[,;:]?\s*(?:#|book\s*|vol(?:ume)?\.?\s*|no\.?\s*)(\d{1,3})\)/i);
  if (t && ok({ series: nameOf(t[1]) }).series) return { series: nameOf(t[1]), seriesNo: num(t[2]) };
  const sub = subjects.map((x) => String(x).match(/^series:\s*(.+)$/i)).filter(Boolean).map((m) => nameOf(m[1].replace(/_/g, ' '))).find((n) => n && ok({ series: n }).series);
  if (sub) return { series: sub, seriesNo: null };
  return { series: null, seriesNo: null };
}

/** Only covers from these hosts are ever stored or shown. */
export const isAllowedCover = (u) => {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && (hostname === 'covers.openlibrary.org' || hostname === 'books.google.com');
  } catch {
    return false;
  }
};

const clean = (s, max) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Open Library descriptions are plain text or { value }, often with markdown links and "----" footers. */
function cleanBlurb(d) {
  const raw = typeof d === 'string' ? d : d?.value;
  if (!raw) return '';
  return String(raw)
    .split(/\n-{3,}|\r?\n\s*\*\*?Source|\r?\n\(\[?source/i)[0]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
    .replace(/[*_]{1,3}/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 2500);
}

export function combineRatings(parts) {
  const good = parts.filter((p) => p && p.count > 0 && p.avg > 0 && p.avg <= 5);
  if (!good.length) return { rating: null, ratingCount: null, ratingSource: null };
  const total = good.reduce((n, p) => n + p.count, 0);
  const avg = good.reduce((n, p) => n + p.avg * p.count, 0) / total;
  return {
    rating: Math.round(avg * 100) / 100,
    ratingCount: total,
    ratingSource: good.map((p) => p.source).join(' + '),
  };
}

export function createBookLookup({ db, fetchImpl = fetch, googleKey = process.env.GOOGLE_BOOKS_API_KEY } = {}) {
  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    } catch {
      throw new UpstreamError('network');
    }
    if (!res.ok) throw new UpstreamError(`status ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new UpstreamError('bad json');
    }
  }

  async function cached(key, maxAge, load) {
    const row = await db.get('SELECT json, fetched_at FROM book_cache WHERE key = ?', [key]);
    if (row && Date.now() - row.fetched_at < maxAge) return JSON.parse(row.json);
    try {
      const value = await load();
      await db.run(
        `INSERT INTO book_cache (key, json, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
        [key, JSON.stringify(value), Date.now()]
      );
      return value;
    } catch (e) {
      if (row) return JSON.parse(row.json); // stale beats nothing
      throw e;
    }
  }

  const coverFor = (doc) => {
    if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${Number(doc.cover_i)}-L.jpg`;
    const isbn = (doc.isbn || []).find(isIsbn);
    return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;
  };

  const usable = (d) => isWorkKey((d.key || '').replace('/works/', '')) && d.title;
  const toResult = (d) => ({
    workKey: d.key.replace('/works/', ''),
    title: clean(d.title, 200),
    authors: (d.author_name || []).slice(0, 1).map((a) => clean(a, 100)),
    year: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null,
    coverUrl: coverFor(d),
    isbn: (d.isbn || []).find((i) => isIsbn(i) && i.length === 13) || (d.isbn || []).find(isIsbn) || null,
    pages: Number.isInteger(d.number_of_pages_median) ? d.number_of_pages_median : null,
    rating: d.ratings_average ? Math.round(d.ratings_average * 100) / 100 : null,
    ratingCount: d.ratings_count || null,
  });
  const FIELDS = 'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,ratings_average,ratings_count';

  return {
    /** The book printed on a barcode (the ISBN under it), or null when the catalog does not know it. */
    async byIsbn(raw) {
      const isbn = normIsbn(raw);
      if (!isbn) return null;
      const key = `isbn:${isbn}`;
      const hit = await db.get('SELECT json, fetched_at FROM book_cache WHERE key = ?', [key]);
      if (hit && Date.now() - hit.fetched_at < 30 * DAY) return JSON.parse(hit.json);
      let result = null;
      try {
        const data = await getJson(`${OL}/search.json?q=isbn:${isbn}&limit=5&fields=${FIELDS}`);
        const doc = (data.docs || []).find(usable);
        if (doc) result = toResult(doc);
      } catch { /* try the edition record below */ }
      let edition = null;
      try { edition = await getJson(`${OL}/isbn/${isbn}.json`); } catch { /* not every edition is listed */ }
      if (!result && edition) {
        const wk = (edition.works?.[0]?.key || '').replace('/works/', '');
        if (isWorkKey(wk) && edition.title) {
          let author = '';
          try { const a = await getJson(`${OL}${edition.authors?.[0]?.key}.json`); author = clean(a.name, 100); } catch { /* unknown author */ }
          result = { workKey: wk, title: clean(edition.title, 200), authors: author ? [author] : [], year: Number.parseInt(String(edition.publish_date || '').match(/\d{4}/)?.[0], 10) || null, coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, isbn, pages: Number.isInteger(edition.number_of_pages) ? edition.number_of_pages : null, rating: null, ratingCount: null };
        }
      }
      if (!result) return null;
      result.isbn = isbn;
      const sr = detectSeries({ title: result.title, editionSeries: edition?.series || [] });
      Object.assign(result, sr);
      if (!result.series) {
        try {
          const work = await getJson(`${OL}/works/${result.workKey}.json`);
          Object.assign(result, detectSeries({ title: result.title, subjects: (work.subjects || []).map((x) => clean(x, 80)) }));
        } catch { /* the series stays unknown */ }
      }
      await db.run(`INSERT INTO book_cache (key, json, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`, [key, JSON.stringify(result), Date.now()]);
      return result;
    },

    /** Series for books the catalog tells us about by ISBN (used when arranging a shelf by series). */
    async seriesFor({ isbn, title, subjects }) {
      let editionSeries = [];
      if (isbn) { try { editionSeries = (await getJson(`${OL}/isbn/${isbn}.json`)).series || []; } catch { /* fall back to title and subjects */ } }
      return detectSeries({ title, subjects, editionSeries });
    },

    async search(q) {
      const query = clean(q, 100).toLowerCase();
      if (query.length < 2) return [];
      return cached(`search:${query}`, DAY, async () => {
        const fields = FIELDS;
        const data = await getJson(`${OL}/search.json?q=${encodeURIComponent(query)}&limit=24&fields=${fields}`);
        return (data.docs || []).filter(usable).map(toResult).slice(0, 20);
      });
    },

    /** Blurb, subjects and combined fan rating for one book. Each source may fail on its own. */
    async details({ workKey, isbn, title, author }) {
      return cached(`details:${workKey}`, 7 * DAY, async () => {
        const out = { description: '', subjects: [], pages: null, coverUrl: null };
        const parts = [];
        let sawAny = false;

        try {
          const work = await getJson(`${OL}/works/${workKey}.json`);
          sawAny = true;
          out.description = cleanBlurb(work.description);
          out.subjects = (work.subjects || []).slice(0, 8).map((s) => clean(s, 40));
          Object.assign(out, detectSeries({ title, subjects: (work.subjects || []).map((s) => clean(s, 80)) }));
        } catch { /* try the other sources */ }

        try {
          const r = await getJson(`${OL}/works/${workKey}/ratings.json`);
          sawAny = true;
          if (r?.summary?.count) parts.push({ source: 'Open Library', avg: r.summary.average, count: r.summary.count });
        } catch { /* ignore */ }

        if (googleKey) {
          try {
            const q = isbn ? `isbn:${isbn}` : `intitle:${title || ''}${author ? `+inauthor:${author}` : ''}`;
            const g = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&key=${encodeURIComponent(googleKey)}`);
            const v = g.items?.[0]?.volumeInfo;
            if (v) {
              sawAny = true;
              if (v.ratingsCount) parts.push({ source: 'Google Books', avg: v.averageRating, count: v.ratingsCount });
              if (!out.description && v.description) out.description = cleanBlurb(v.description);
              if (!out.subjects.length && v.categories) out.subjects = v.categories.slice(0, 8).map((s) => clean(s, 40));
              if (Number.isInteger(v.pageCount) && v.pageCount > 0) out.pages = v.pageCount;
            }
          } catch { /* ignore */ }
        }

        if (!sawAny) throw new UpstreamError('no source answered');
        return { ...out, ...combineRatings(parts) };
      });
    },
  };
}
