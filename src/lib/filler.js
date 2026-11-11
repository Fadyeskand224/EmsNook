// A library is full of books. These are the decorative volumes that fill the space around the reader's own books:
// sets of uniform leather-bound volumes, odd singles, a leaning book, a pile lying flat. They are generated from a seed,
// so every shelf looks the same on every visit, and they are never part of the reader's collection.

const PALS = [
  ['#6b2118', '#e3c58a', '#d6a94a'], ['#2a4331', '#e6d7ad', '#c8a55a'], ['#1f2f4a', '#e0d6bb', '#cfa653'], ['#4a2c1a', '#e2c795', '#b98b3e'],
  ['#1b1613', '#d9bd7d', '#d9bd7d'], ['#8a5a2e', '#2a1608', '#f0d494'], ['#5a1f2c', '#ecd9b0', '#d9a74e'], ['#40472a', '#ecdfb6', '#d6b25a'],
  ['#7a3a22', '#f0dcb0', '#e0b660'], ['#2c3640', '#d8d2bd', '#c9a85a'], ['#a07a44', '#2a1a0c', '#5c3a14'], ['#8c2b1f', '#f1dfb6', '#e5bd62'],
];
const WORDS = ['Annals', 'Essays', 'Letters', 'Poems', 'Atlas', 'History', 'Travels', 'Sermons', 'Memoirs', 'Voyages', 'Chronicles', 'Works', 'Treatise', 'Reports', 'Journals', 'Natural History'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
const STYLES = ['plain', 'bands', 'panel', 'stripe'];
const FONTS = ['serif', 'sans', 'slab'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

/** Decorative items to fill `space` design pixels (a width at zoom 1). */
export function makeFiller(seed, space) {
  const key = `${seed}:${Math.round(space / 6)}`;
  if (cache.has(key)) return cache.get(key);
  const rnd = rng(seed * 7919 + 13);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const items = [];
  let left = space;
  const book = (pal, w, h, title, style, font, kind = 'book') => ({
    kind,
    book: { workKey: `f${seed}-${items.length}`, title, authors: [''] },
    design: { bg: pal[0], fg: pal[1], accent: pal[2], width: w, height: h, style, font, photo: null },
  });
  while (left > 22) {
    const r = rnd();
    if (r < 0.6) {
      const n = 3 + Math.floor(rnd() * 9);
      const pal = pick(PALS), word = pick(WORDS), style = pick(STYLES), font = pick(FONTS);
      const w = 24 + Math.floor(rnd() * 14), h = 172 + Math.floor(rnd() * 30);
      for (let i = 0; i < n && left > w + 2; i++) { items.push(book(pal, w, h, `${word} ${ROMAN[i]}`, style, font)); left -= w + 2; }
    } else if (r < 0.88) {
      const w = 20 + Math.floor(rnd() * 28), h = 150 + Math.floor(rnd() * 56);
      if (left > w + 2) { items.push(book(pick(PALS), w, h, pick(WORDS), pick(STYLES), pick(FONTS))); left -= w + 2; }
    } else if (r < 0.94 && left > 100) {
      items.push({ kind: 'stack', book: { workKey: `s${seed}-${items.length}`, title: '', authors: [''] } });
      left -= 80;
    } else if (left > 70) {
      const w = 26 + Math.floor(rnd() * 12);
      items.push(book(pick(PALS), w, 178 + Math.floor(rnd() * 24), pick(WORDS), pick(STYLES), pick(FONTS), 'lean'));
      left -= w + 30;
    } else break;
  }
  cache.set(key, items);
  return items;
}

/**
 * Splits the reader's spines into shelf levels of `nBays` bays each. A bay holds what fits in `bayPx`;
 * `reserve(level)` is room kept at the end of the last bay for a decoration.
 */
export function packBays(designs, zoom, bayPx, nBays, reserve = () => 0, minRows = 5) {
  const cap = (level, bay) => bayPx - (bay === nBays - 1 ? reserve(level) : 0);
  const newRow = () => Array.from({ length: nBays }, () => ({ books: [], used: 0 }));
  const rows = [newRow()];
  let bay = 0;
  for (const d of designs) {
    const w = d.width * zoom + 2 * zoom;
    let row = rows[rows.length - 1];
    if (row[bay].used + w > cap(rows.length - 1, bay) && row[bay].books.length) {
      bay++;
      if (bay >= nBays) { rows.push(newRow()); bay = 0; row = rows[rows.length - 1]; } else row = rows[rows.length - 1];
    }
    row[bay].books.push(d);
    row[bay].used += w;
  }
  while (rows.length < minRows) rows.push(newRow());
  return rows.map((row, level) => row.map((b, i) => ({ ...b, cap: cap(level, i) })));
}
