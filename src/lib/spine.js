// Every book gets a stable spine. Colours come from the real cover when we have read it (lib/coverColors.js), or from the
// title when we have not; a reader's own spine photo, when they added one, replaces all of it.
import { paletteFor } from './coverColors';

// [background, text, accent]
const PALETTE = [
  ['#7a2e24', '#f1dcc0', '#d9a24c'], // oxblood
  ['#2f4a3a', '#efe3c8', '#c9a25a'], // forest
  ['#23364f', '#e9dfc9', '#d2a95a'], // navy
  ['#a8552b', '#fbebd2', '#f1c27a'], // rust
  ['#d9c3a0', '#3b2a1c', '#8a5a2b'], // parchment
  ['#4b2e4f', '#f0dfcf', '#d6a86a'], // plum
  ['#1f2b2b', '#e6d9bd', '#b98b4a'], // deep teal
  ['#b9883b', '#2b1a0d', '#5a3a14'], // mustard
  ['#6b7f58', '#faf0d8', '#e8c97f'], // sage
  ['#8b3a4a', '#fbe9d6', '#e5b574'], // rose
  ['#3d5a6c', '#f2e8d3', '#e0b872'], // slate
  ['#e8dcc4', '#2f3e2f', '#7a5b2e'], // cream
  ['#c9663f', '#2a140a', '#f6d9a8'], // terracotta
  ['#2b2622', '#f0d9a0', '#f0d9a0'], // black & gold
];
const STYLES = ['plain', 'bands', 'panel', 'stripe'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FONTS = ['serif', 'sans', 'slab'];
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Design size is the spine at zoom 1, in CSS pixels. */
export function spineDesign(book) {
  const h = hash(`${book.workKey}|${book.title}`);
  const pal = paletteFor(book.workKey);
  const [bg, fg, accent] = pal ? [pal.bg, pal.fg, pal.accent] : PALETTE[h % PALETTE.length];
  const pages = book.pages || 200 + (h % 300);
  const height = 168 + ((h >> 5) % 6) * 7; // 168 to 203
  let width = Math.round(Math.min(54, Math.max(26, 20 + pages / 16)));
  let photo = null;
  if (book.spineV && book.spineW && book.spineH) {
    photo = `/api/library/${book.id}/spine?v=${book.spineV}`;
    width = Math.round(clampN((height * book.spineW) / book.spineH, 18, 84)); // a real spine keeps its real proportions
  }
  width = Math.round(clampN(width * (book.thick ?? 1), 14, 110)); // the reader's own size tweaks
  const tall = Math.round(height * (book.tall ?? 1));
  return { bg, fg, accent, width, height: tall, photo, font: FONTS[(h >> 13) % FONTS.length], style: STYLES[(h >> 9) % STYLES.length], h };
}

/** Title size that fits the spine, in design pixels. Long titles with several words wrap onto two lines instead of shrinking away. */
export function spineFontSize(title, design) {
  const room = design.height - 92;
  const len = title.length * (design.font === 'sans' ? 1.28 : 1); // spaced capitals run wider
  const oneLine = room / (len * 0.62);
  const longestWord = Math.max(...title.split(/\s+/).map((w) => w.length));
  const canWrap = /\s/.test(title);
  if (oneLine >= 10.5 || !canWrap) return { size: Math.max(8, Math.min(design.width * 0.4, 15, oneLine)), wrap: false };
  // two lines: the longest word must still fit on its own line, and two columns must fit the spine's width
  const size = Math.min(design.width / 3, 13, room / (longestWord * 0.66), room / (len * 0.58 * 0.62));
  return { size: Math.max(7.5, size), wrap: true };
}

/** Splits spines into shelf rows that fit the available width. `reserve(rowIndex)` is space kept for decorations. */
export function packRows(designs, zoom, width, reserve = () => 0) {
  const rows = [[]];
  let used = 0;
  for (const d of designs) {
    const w = d.width * zoom + 2 * zoom;
    const cap = Math.max(60, width - reserve(rows.length - 1));
    if (used + w > cap && rows[rows.length - 1].length) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(d);
    used += w;
  }
  return rows;
}
