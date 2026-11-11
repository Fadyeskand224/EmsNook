// Spines take their colours from the book's real cover: the cover image is sampled for its dominant and accent colours.
// Results are remembered on this device, so each cover is only read once.
import { useEffect, useState } from 'react';

const KEY = 'emsnook-palettes-v2';
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* start fresh */ }
const failed = new Set();
const inflight = new Set();
const listeners = new Set();
let queue = [];
let running = 0;

export const paletteFor = (workKey) => store[workKey] || null;

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const CREAM = [244, 234, 214];
const INK = [29, 21, 15];

function analyse(img) {
  const W = 48, H = 72;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const buckets = new Map();
  let total = 0;
  const mx = Math.round(W * 0.06), my = Math.round(H * 0.05); // skip scanner borders and trim marks
  for (let y = my; y < H - my; y++) for (let x = mx; x < W - mx; x++) {
    const i = (y * W + x) * 4;
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); // coarse buckets, so smooth tones add up
    const wgt = x < W * 0.28 || y < H * 0.14 ? 2 : 1; // the cover's left edge and top band echo most on a spine
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n += wgt; e.r += r * wgt; e.g += g * wgt; e.b += b * wgt;
    buckets.set(key, e);
    total += wgt;
  }
  if (!total) return null;
  const list = [...buckets.values()].map((e) => ({ n: e.n, c: [e.r / e.n, e.g / e.n, e.b / e.n] })).sort((p, q) => q.n - p.n);
  // black is the most common single tone on photographic covers; only trust it when it truly dominates
  let dom = list[0];
  if (lum(dom.c) < 0.02 && dom.n / total < 0.55) dom = list.find((e) => lum(e.c) >= 0.02 && e.n / total > 0.04) || dom;
  const bg = dom.c.map((v) => v * 0.93); // spines sit in shade, a touch darker than the cover
  let accent = null;
  let best = 0;
  for (const e of list.slice(0, 40)) {
    if (e === dom || e.n / total < 0.025 || dist(e.c, bg) < 80) continue;
    const score = e.n * (0.4 + sat(e.c));
    if (score > best) { best = score; accent = e.c; }
  }
  if (!accent) accent = lum(bg) > 0.4 ? bg.map((v) => v * 0.45) : bg.map((v) => Math.min(255, v * 1.7 + 40));
  // lettering: whichever reads best on the spine
  const options = [CREAM, INK, accent].filter((o) => o);
  options.sort((p, q) => contrast(q, bg) - contrast(p, bg));
  let fg = options[0];
  if (accent && contrast(accent, bg) >= 4.5 && sat(accent) > 0.35) fg = accent;
  else if (contrast(CREAM, bg) >= contrast(INK, bg)) fg = CREAM; else fg = INK;
  return { bg: toHex(bg), fg: toHex(fg), accent: toHex(contrast(accent, bg) > 1.8 ? accent : fg) };
}

function load(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { try { resolve(analyse(img)); } catch { resolve(null); } };
    img.onerror = () => resolve(null);
    img.src = url.replace('-L.jpg', '-M.jpg');
  });
}

function pump() {
  while (running < 3 && queue.length) {
    const { workKey, url } = queue.shift();
    running++;
    load(url).then((pal) => {
      if (pal) {
        store = { ...store, [workKey]: pal };
        try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full: fine */ }
        listeners.forEach((fn) => fn());
      } else failed.add(workKey);
    }).finally(() => { running--; inflight.delete(workKey); pump(); });
  }
}

/** Starts reading covers for these books and re-renders the caller as colours arrive. */
export function usePalettes(books) {
  const [, tick] = useState(0);
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    listeners.add(on);
    return () => listeners.delete(on);
  }, []);
  useEffect(() => {
    for (const b of books) {
      if (!b.coverUrl || store[b.workKey] || failed.has(b.workKey) || inflight.has(b.workKey)) continue;
      inflight.add(b.workKey);
      queue.push({ workKey: b.workKey, url: b.coverUrl });
    }
    pump();
  }, [books]);
}
export { hexRgb };
