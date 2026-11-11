// Every surface in the 3D room is painted here with the 2D canvas, once, and cached: wood grain, parquet, the Persian rug,
// damask wallpaper, tufted leather, the globe. No image files are downloaded for the room itself.
import * as THREE from 'three';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
};
const texOf = (c, { srgb = true, repeat = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ───────── wood ─────────
/** Grain runs along x. Seamless left to right and top to bottom. */
function grainCanvas(light, dark, seed) {
  const L = hex(light);
  const D = hex(dark);
  const r = rng(seed * 977 + 5);
  return canvas(512, 512, (g, w, h) => {
    const base = mix(D, L, 0.55);
    g.fillStyle = css(base);
    g.fillRect(0, 0, w, h);
    // broad colour drift between boards
    for (let i = 0; i < 14; i++) {
      const y = r() * h;
      const band = g.createLinearGradient(0, y - 40, 0, y + 40);
      const c = mix(D, L, r());
      band.addColorStop(0, css(c, 0));
      band.addColorStop(0.5, css(c, 0.35));
      band.addColorStop(1, css(c, 0));
      g.fillStyle = band;
      g.fillRect(0, y - 40, w, 80);
    }
    // the grain: long wavy lines
    for (let i = 0; i < 260; i++) {
      const y0 = r() * h;
      const amp = 1 + r() * 7;
      const k = 1 + Math.floor(r() * 3);
      const ph = r() * 6.28;
      const c = r() < 0.55 ? mix(D, [0, 0, 0], 0.25) : mix(L, [255, 235, 200], 0.2);
      g.strokeStyle = css(c, 0.05 + r() * 0.22);
      g.lineWidth = 0.5 + r() * 2.2;
      for (const off of [-h, 0, h]) {
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + off + Math.sin((x / w) * 6.2832 * k + ph) * amp);
        g.stroke();
      }
    }
    // a few knots
    for (let n = 0; n < 2; n++) {
      const cx = r() * w;
      const cy = r() * h;
      for (let ring = 9; ring > 0; ring--) {
        g.strokeStyle = css(mix(D, [0, 0, 0], 0.3), 0.08 + ring * 0.015);
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(cx, cy, ring * 5 + 4, ring * 1.6 + 2, 0, 0, 6.2832);
        g.stroke();
      }
    }
    // pores
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = css([0, 0, 0], r() * 0.14);
      g.fillRect(r() * w, r() * h, 2 + r() * 7, 1);
    }
  });
}

/** Wood textures for one finish: grain along x ("h") and along y ("v"). */
export function woodTextures(light, dark, seed) {
  return once(`wood:${light}:${dark}:${seed}`, () => {
    const base = grainCanvas(light, dark, seed);
    const h = texOf(base);
    const vc = canvas(512, 512, (g, w, hh) => {
      g.translate(w / 2, hh / 2);
      g.rotate(Math.PI / 2);
      g.drawImage(base, -w / 2, -hh / 2);
    });
    return { h, v: texOf(vc) };
  });
}

// ───────── floor ─────────
export function parquetTexture(light, dark) {
  return once(`parquet:${light}:${dark}`, () => {
    const r = rng(41);
    const L = hex(light);
    const D = hex(dark);
    const c = canvas(1024, 1024, (g, w, h) => {
      const blocks = 8;
      const bs = w / blocks;
      const planks = 4;
      for (let by = 0; by < blocks; by++) {
        for (let bx = 0; bx < blocks; bx++) {
          const horiz = (bx + by) % 2 === 0;
          for (let p = 0; p < planks; p++) {
            const tone = mix(D, L, 0.35 + r() * 0.55);
            const x = bx * bs + (horiz ? 0 : (p * bs) / planks);
            const y = by * bs + (horiz ? (p * bs) / planks : 0);
            const pw = horiz ? bs : bs / planks;
            const ph = horiz ? bs / planks : bs;
            g.fillStyle = css(tone);
            g.fillRect(x, y, pw, ph);
            for (let i = 0; i < 7; i++) {
              g.strokeStyle = css(mix(tone, [0, 0, 0], 0.4), 0.18);
              g.lineWidth = 0.7;
              g.beginPath();
              if (horiz) { const yy = y + r() * ph; g.moveTo(x, yy); g.lineTo(x + pw, yy + (r() - 0.5) * 3); }
              else { const xx = x + r() * pw; g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 3, y + ph); }
              g.stroke();
            }
            g.strokeStyle = 'rgba(10,4,0,0.55)';
            g.lineWidth = 1.6;
            g.strokeRect(x, y, pw, ph);
          }
        }
      }
      const v = g.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.75);
      v.addColorStop(0, 'rgba(255,230,190,0.05)');
      v.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    });
    return texOf(c);
  });
}

// ───────── Persian rug ─────────
const RUGS = {
  persian: { RED: '#7d1d1b', DEEP: '#4d0f12', NAVY: '#1c2a4a', CREAM: '#dcc896', GOLD: '#b88a3c', TEAL: '#2c5a5c' },
  navy: { RED: '#1f3358', DEEP: '#101c36', NAVY: '#6b1d1b', CREAM: '#dccfa6', GOLD: '#c39a48', TEAL: '#3d6b73' },
  forest: { RED: '#27442f', DEEP: '#142a1d', NAVY: '#5a1d1d', CREAM: '#d9c99a', GOLD: '#b8903e', TEAL: '#7a5b2a' },
  cream: { RED: '#d8c8a2', DEEP: '#a8946a', NAVY: '#6a5a3e', CREAM: '#efe3c4', GOLD: '#9a7a3c', TEAL: '#8a8a64' },
};
export function rugTexture(kind = 'persian') {
  return once(`rug:${kind}`, () => {
    const P = RUGS[kind] || RUGS.persian;
    const r = rng(7);
    const c = canvas(1024, 1536, (g, w, h) => {
      const { RED, DEEP, NAVY, CREAM, GOLD, TEAL } = P;
      g.fillStyle = RED;
      g.fillRect(0, 0, w, h);
      const frame = (inset, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
      // border bands
      g.fillStyle = NAVY; g.fillRect(36, 36, w - 72, h - 72);
      g.fillStyle = RED; g.fillRect(110, 110, w - 220, h - 220);
      frame(24, CREAM, 8); frame(46, GOLD, 4); frame(100, CREAM, 6); frame(116, GOLD, 3);
      // border ornaments
      const orn = (x, y, s, rot) => {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.fillStyle = CREAM; g.beginPath();
        for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.7, s * 0.2, s, 0); g.quadraticCurveTo(s * 0.7, -s * 0.2, 0, 0); }
        g.fill();
        g.fillStyle = GOLD; g.beginPath(); g.arc(0, 0, s * 0.2, 0, 6.2832); g.fill();
        g.restore();
      };
      for (let x = 90; x < w - 60; x += 74) { orn(x, 73, 26, 0); orn(x, h - 73, 26, 0); }
      for (let y = 90; y < h - 60; y += 74) { orn(73, y, 26, 0); orn(w - 73, y, 26, 0); }
      // field: lattice of small motifs
      g.save(); g.beginPath(); g.rect(130, 130, w - 260, h - 260); g.clip();
      for (let y = 160; y < h - 140; y += 90) {
        for (let x = 160; x < w - 140; x += 90) {
          const odd = ((x - 160) / 90 + (y - 160) / 90) % 2 === 0;
          g.fillStyle = odd ? DEEP : TEAL;
          g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 18, y); g.lineTo(x, y + 24); g.lineTo(x - 18, y); g.closePath(); g.fill();
          g.fillStyle = odd ? GOLD : CREAM;
          g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.fill();
        }
      }
      // medallion
      const cx = w / 2;
      const cy = h / 2;
      const diamond = (rx, ry, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(cx, cy - ry); g.lineTo(cx + rx, cy); g.lineTo(cx, cy + ry); g.lineTo(cx - rx, cy); g.closePath(); g.fill(); };
      diamond(330, 470, DEEP); diamond(300, 430, CREAM); diamond(280, 405, NAVY); diamond(230, 340, RED); diamond(170, 250, TEAL); diamond(120, 175, CREAM); diamond(90, 130, DEEP);
      g.fillStyle = GOLD; g.beginPath(); g.arc(cx, cy, 36, 0, 6.2832); g.fill();
      g.fillStyle = RED; g.beginPath(); g.arc(cx, cy, 20, 0, 6.2832); g.fill();
      for (let i = 0; i < 8; i++) { g.save(); g.translate(cx, cy); g.rotate((i * Math.PI) / 4); orn(0, 205, 34, 0); g.restore(); }
      g.restore();
      // wool: pile noise and wear
      const img = g.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (r() - 0.5) * 34;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
      // fringe
      g.fillStyle = 'rgba(225,208,170,0.9)';
      for (let x = 4; x < w; x += 7) { g.fillRect(x, 0, 3, 14); g.fillRect(x, h - 14, 3, 14); }
    });
    return texOf(c, { repeat: false });
  });
}

// ───────── wallpaper ─────────
export function wallTexture(color) {
  return once(`wall:${color}`, () => {
    const base = hex(color);
    const hi = mix(base, [255, 235, 200], 0.14);
    const lo = mix(base, [0, 0, 0], 0.22);
    const c = canvas(512, 512, (g, w, h) => {
      g.fillStyle = css(base);
      g.fillRect(0, 0, w, h);
      const r = rng(99);
      for (let i = 0; i < 4000; i++) { g.fillStyle = css(r() < 0.5 ? lo : hi, 0.05); g.fillRect(r() * w, r() * h, 2, 2); }
      const motif = (x, y) => {
        g.save(); g.translate(x, y);
        g.strokeStyle = css(hi, 0.5); g.fillStyle = css(hi, 0.3); g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, -70); g.bezierCurveTo(50, -40, 50, 30, 0, 70); g.bezierCurveTo(-50, 30, -50, -40, 0, -70); g.stroke();
        g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(24, -18, 24, 18, 0, 38); g.bezierCurveTo(-24, 18, -24, -18, 0, -38); g.fill();
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 70); g.bezierCurveTo(s * 40, 84, s * 62, 64, s * 58, 40); g.stroke(); }
        g.restore();
      };
      for (let y = 0; y <= h; y += 256) for (let x = 0; x <= w; x += 256) { motif(x + 128, y + 128); motif(x, y); }
    });
    return texOf(c);
  });
}

// ───────── leather ─────────
export function leatherTextures(color, tufted = true) {
  return once(`leather:${color}:${tufted}`, () => {
    const base = hex(color);
    const r = rng(23);
    const map = canvas(512, 512, (g, w, h) => {
      g.fillStyle = css(base); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = css(r() < 0.5 ? [0, 0, 0] : [255, 220, 190], 0.05 + r() * 0.06); g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      if (tufted) {
        const n = 4;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
          const x = (i / n) * w; const y = (j / n) * h;
          const rad = g.createRadialGradient(x, y, 0, x, y, 70);
          rad.addColorStop(0, 'rgba(0,0,0,0.65)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rad; g.fillRect(x - 70, y - 70, 140, 140);
        }
      }
    });
    const bump = canvas(512, 512, (g, w, h) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
      if (tufted) {
        const n = 4;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
          const x = (i / n) * w; const y = (j / n) * h;
          const rad = g.createRadialGradient(x, y, 0, x, y, 80);
          rad.addColorStop(0, '#000'); rad.addColorStop(1, 'rgba(154,154,154,0)');
          g.fillStyle = rad; g.fillRect(x - 80, y - 80, 160, 160);
        }
        g.strokeStyle = 'rgba(40,40,40,0.8)'; g.lineWidth = 5;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const x0 = (i / n) * w; const y0 = (j / n) * h; const s = w / n;
          g.beginPath(); g.moveTo(x0 + s / 2, y0); g.lineTo(x0 + s, y0 + s / 2); g.lineTo(x0 + s / 2, y0 + s); g.lineTo(x0, y0 + s / 2); g.closePath(); g.stroke();
        }
      }
      for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0,0.04)`; g.fillRect(r() * w, r() * h, 2, 2); }
    });
    return { map: texOf(map), bump: texOf(bump, { srgb: false }) };
  });
}

// ───────── columns ─────────
export function flutingBump() {
  return once('flutes', () => {
    const c = canvas(512, 8, (g, w, h) => {
      for (let x = 0; x < w; x++) {
        const v = 0.5 + 0.5 * Math.cos((x / w) * 6.2832 * 16);
        const k = Math.round(70 + v * 150);
        g.fillStyle = `rgb(${k},${k},${k})`;
        g.fillRect(x, 0, 1, h);
      }
    });
    const t = texOf(c, { srgb: false });
    return t;
  });
}

// ───────── books ─────────
/** Soft light/dark banding for the spines of the decorative books. Multiplied by each book's own colour. */
export function spineBands(variant) {
  return once(`bands:${variant}`, () => {
    const c = canvas(64, 256, (g, w, h) => {
      g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, w, h);
      const line = (y, th = 3, col = '#ffffff') => { g.fillStyle = col; g.fillRect(4, y, w - 8, th); };
      if (variant === 0) { line(22); line(30, 1.5); line(h - 30); line(h - 38, 1.5); }
      if (variant === 1) { for (let i = 0; i < 4; i++) line(20 + i * 7, 2); line(h - 40, 5); line(h - 26, 2); }
      if (variant === 2) { g.fillStyle = '#fff'; g.fillRect(8, 60, w - 16, 80); g.fillStyle = '#9a9a9a'; g.fillRect(12, 64, w - 24, 72); line(24, 4); line(h - 28, 4); }
      if (variant === 3) { g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, w, 28); g.fillRect(0, h - 28, w, 28); line(34, 2); line(h - 36, 2); line(h / 2, 2); }
      const sh = g.createLinearGradient(0, 0, w, 0);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(0.25, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      const r = rng(variant + 3);
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.1})`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 4); }
    });
    return texOf(c, { repeat: false });
  });
}

/** One of the reader's own spines: title, author and gauge, drawn from the same design the flat shelf uses. */
export function spineCanvas(book, design, pct) {
  const W = 96;
  const H = Math.round((W * design.height) / design.width);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const fam = design.font === 'sans' ? '"DM Sans", Helvetica, sans-serif' : design.font === 'slab' ? 'Rockwell, "Roboto Slab", Georgia, serif' : '"Fraunces", Georgia, serif';
  g.fillStyle = design.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = design.accent;
  if (design.style === 'bands') { for (const y of [18, 24, H - 30, H - 24]) g.fillRect(4, y, W - 8, 2.5); }
  else if (design.style === 'stripe') { g.fillRect(W * 0.42, 0, 3, H); g.fillRect(W * 0.58, 0, 3, H); }
  else if (design.style === 'panel') { g.globalAlpha = 0.9; g.strokeStyle = design.accent; g.lineWidth = 2; g.strokeRect(6, 40, W - 12, H - 120); g.globalAlpha = 1; }
  else { g.fillRect(4, 14, W - 8, 2.5); g.fillRect(4, H - 18, W - 8, 2.5); }
  // title runs top to bottom, as on a real spine
  g.save();
  g.translate(W / 2, 46);
  g.rotate(Math.PI / 2);
  g.fillStyle = design.fg;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const title = book.title.length > 44 ? `${book.title.slice(0, 42)}…` : book.title;
  let size = Math.min(W * 0.46, 40);
  const room = H - 46 - 62;
  g.font = `700 ${size}px ${fam}`;
  while (g.measureText(title).width > room && size > 9) { size -= 1; g.font = `700 ${size}px ${fam}`; }
  g.fillText(title, 0, 0);
  g.restore();
  const author = (book.authors[0] || '').split(' ').slice(-1)[0];
  if (author) {
    g.save(); g.translate(W / 2, H - 22); g.rotate(-Math.PI / 2);
    g.fillStyle = design.fg; g.globalAlpha = 0.85; g.font = `600 ${Math.min(14, W * 0.17)}px ${fam}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(author.toUpperCase(), 0, 0);
    g.restore();
  }
  // a fill gauge for a book in progress
  if (pct != null) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(4, H - 14, W - 8, 6);
    g.fillStyle = '#ffd98a'; g.fillRect(4, H - 14, ((W - 8) * pct) / 100, 6);
  }
  const sh = g.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(0.25, 'rgba(255,255,255,0.1)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  return c;
}
export const toTexture = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// ───────── globe ─────────
export function globeTexture() {
  return once('globe', () => {
    const c = canvas(1024, 512, (g, w, h) => {
      const sea = g.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#9db4ae'); sea.addColorStop(0.5, '#86a7a8'); sea.addColorStop(1, '#9db4ae');
      g.fillStyle = sea; g.fillRect(0, 0, w, h);
      const P = (lon, lat) => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
      const poly = (pts, col) => { g.fillStyle = col; g.strokeStyle = '#7a5b30'; g.lineWidth = 1.5; g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke(); };
      poly([[-168, 66], [-140, 70], [-95, 72], [-70, 63], [-55, 50], [-66, 44], [-76, 35], [-81, 25], [-97, 18], [-88, 15], [-80, 8], [-105, 20], [-117, 33], [-124, 42], [-130, 55], [-150, 60]], '#d8c086');
      poly([[-80, 8], [-60, 10], [-36, -6], [-40, -22], [-58, -38], [-68, -54], [-74, -40], [-70, -18], [-81, -5]], '#cdb87c');
      poly([[-10, 36], [0, 44], [-8, 52], [10, 58], [30, 70], [60, 72], [100, 76], [140, 72], [170, 66], [150, 48], [130, 36], [122, 24], [105, 10], [80, 8], [60, 24], [40, 30], [28, 40], [12, 40]], '#dcc78e');
      poly([[-17, 21], [-6, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -30], [20, -35], [12, -18], [9, 4], [-8, 5]], '#d2bd80');
      poly([[114, -22], [130, -12], [143, -11], [153, -27], [146, -39], [130, -32], [116, -35]], '#d6c188');
      poly([[-52, 83], [-20, 82], [-24, 70], [-44, 60], [-54, 68]], '#e0d6b4');
      poly([[-180, -66], [180, -66], [180, -90], [-180, -90]], '#e8e0cc');
      g.strokeStyle = 'rgba(90,60,25,0.35)'; g.lineWidth = 1;
      for (let lon = -180; lon <= 180; lon += 30) { const [x] = P(lon, 0); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let lat = -60; lat <= 60; lat += 30) { const [, y] = P(0, lat); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = 'rgba(120,80,30,0.18)'; g.fillRect(0, 0, w, h);
    });
    return texOf(c, { repeat: false });
  });
}

// ───────── light ─────────
export function glowTexture() {
  return once('glow', () => {
    const c = canvas(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.25, 'rgba(255,200,120,0.55)'); r.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
    return texOf(c, { repeat: false });
  });
}
export function shaftTexture() {
  return once('shaft', () => {
    const c = canvas(64, 256, (g, w, h) => {
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(255,240,205,0.9)'); v.addColorStop(0.6, 'rgba(255,225,170,0.35)'); v.addColorStop(1, 'rgba(255,210,150,0)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      const s = g.createLinearGradient(0, 0, w, 0);
      s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.5, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = s; g.fillRect(0, 0, w, h);
    });
    return texOf(c, { repeat: false });
  });
}

// ───────── more floors and surfaces ─────────
export function planksTexture(light, dark) {
  return once(`planks:${light}:${dark}`, () => {
    const r = rng(77);
    const L = hex(light); const D = hex(dark);
    const c = canvas(1024, 1024, (g, w, h) => {
      const pw = w / 6;
      for (let i = 0; i < 6; i++) {
        let y = -r() * 300;
        while (y < h) {
          const len = 320 + r() * 380;
          const tone = mix(D, L, 0.3 + r() * 0.6);
          g.fillStyle = css(tone); g.fillRect(i * pw, y, pw, len);
          for (let k = 0; k < 24; k++) { g.strokeStyle = css(mix(tone, [0, 0, 0], 0.45), 0.2); g.lineWidth = 0.8; const xx = i * pw + r() * pw; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 6, y + len); g.stroke(); }
          g.fillStyle = 'rgba(8,3,0,0.7)'; g.fillRect(i * pw, y, pw, 2.5);
          y += len;
        }
        g.fillStyle = 'rgba(8,3,0,0.7)'; g.fillRect(i * pw, 0, 2.5, h);
      }
    });
    return texOf(c);
  });
}
export function checkerTexture() {
  return once('checker', () => {
    const r = rng(12);
    const c = canvas(1024, 1024, (g, w, h) => {
      const n = 8; const s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dark = (x + y) % 2 === 0;
        const base = dark ? [38, 36, 38] : [226, 220, 208];
        g.fillStyle = css(base); g.fillRect(x * s, y * s, s, s);
        for (let k = 0; k < 6; k++) { g.strokeStyle = css(dark ? [150, 150, 160] : [150, 140, 130], 0.2); g.lineWidth = 1 + r() * 1.5; g.beginPath(); const sx = x * s + r() * s; const sy = y * s + r() * s; g.moveTo(sx, sy); g.bezierCurveTo(sx + 40, sy + 30 * r(), sx + 60 * r(), sy + 80, sx + 90 * r(), sy + 120 * r()); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(x * s, y * s, s, s);
      }
    });
    return texOf(c);
  });
}
export function marbleTexture() {
  return once('marble', () => {
    const r = rng(31);
    const c = canvas(512, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#ece8e0'); grd.addColorStop(1, '#d6d0c6');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) {
        g.strokeStyle = `rgba(${90 + r() * 40},${90 + r() * 40},${100 + r() * 40},${0.15 + r() * 0.35})`; g.lineWidth = 0.6 + r() * 2.4;
        g.beginPath(); let x = r() * w; let y = 0; g.moveTo(x, y);
        while (y < h) { x += (r() - 0.5) * 70; y += 20 + r() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    });
    return texOf(c);
  });
}
export function stoneTexture() {
  return once('stone', () => {
    const r = rng(9);
    const c = canvas(512, 512, (g, w, h) => {
      g.fillStyle = '#5a5248'; g.fillRect(0, 0, w, h);
      const rowH = 64;
      for (let y = 0; y < h; y += rowH) {
        let x = -r() * 80;
        while (x < w) {
          const bw = 90 + r() * 90; const t = 70 + r() * 70;
          g.fillStyle = `rgb(${t + 20},${t + 12},${t})`; g.fillRect(x + 2, y + 2, bw - 4, rowH - 4);
          for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.06)`; g.fillRect(x + r() * bw, y + r() * rowH, 2 + r() * 4, 2 + r() * 3); }
          x += bw;
        }
      }
    });
    return texOf(c);
  });
}
export function firebrickTexture() {
  return once('firebrick', () => {
    const r = rng(2);
    const c = canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#120a07'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
        const t = 60 + r() * 40; g.fillStyle = `rgb(${t + 20},${t * 0.55},${t * 0.4})`; g.fillRect(x + 2, y + 2, 60, 28);
      }
      const soot = g.createRadialGradient(w / 2, h, 20, w / 2, h / 2, h); soot.addColorStop(0, 'rgba(0,0,0,0.1)'); soot.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = soot; g.fillRect(0, 0, w, h);
    });
    return texOf(c);
  });
}
/** A moody oil landscape for the painting over the mantel. */
export function paintingTexture() {
  return once('painting', () => {
    const r = rng(64);
    const c = canvas(512, 360, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.65); sky.addColorStop(0, '#26364a'); sky.addColorStop(0.55, '#c98d5a'); sky.addColorStop(1, '#f1c27e');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const sun = g.createRadialGradient(w * 0.68, h * 0.5, 4, w * 0.68, h * 0.5, 90); sun.addColorStop(0, 'rgba(255,240,200,0.95)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = sun; g.fillRect(0, 0, w, h);
      const hills = (y, col, amp) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.013 + amp) * amp * 3 + Math.sin(x * 0.04) * amp); g.lineTo(w, h); g.fill(); };
      hills(h * 0.62, '#6b5a47', 9); hills(h * 0.7, '#44503a', 12); hills(h * 0.82, '#26301f', 8);
      for (let i = 0; i < 9; i++) { const x = 30 + r() * (w - 60); const y = h * 0.78 + r() * 40; g.fillStyle = '#141a0e'; g.beginPath(); g.ellipse(x, y, 10 + r() * 12, 22 + r() * 22, 0, 0, 6.2832); g.fill(); g.fillRect(x - 2, y, 4, 22); }
      const img = g.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 16; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
      g.putImageData(img, 0, 0);
    });
    return texOf(c, { repeat: false });
  });
}
export function flameTexture() {
  return once('flame', () => {
    const c = canvas(64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(32, 92, 2, 32, 80, 56);
      gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.3, 'rgba(255,190,80,0.95)'); gr.addColorStop(0.7, 'rgba(230,80,20,0.55)'); gr.addColorStop(1, 'rgba(200,40,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(54, 40, 62, 80, 32, 124); g.bezierCurveTo(2, 80, 10, 40, 32, 2); g.fill();
    });
    return texOf(c, { repeat: false });
  });
}
export function furTexture() {
  return once('fur', () => {
    const r = rng(5);
    const c = canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#e4d8c0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { g.strokeStyle = `rgba(${150 + r() * 90},${140 + r() * 80},${120 + r() * 70},0.5)`; g.lineWidth = 1; const x = r() * w; const y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8); g.stroke(); }
    });
    return texOf(c, { repeat: false });
  });
}

// ───────── outside the windows ─────────
/** A wrap-around view of the countryside, seen through every window from the right direction. One per time of day. */
export function panoramaTexture(kind) {
  return once(`pano:${kind}`, () => {
    const r = rng(kind === 'night' ? 3 : kind === 'day' ? 8 : 5);
    const c = canvas(2048, 1024, (g, w, h) => {
      const H = h / 2; // the horizon
      const P = {
        golden: { top: '#34466f', mid: '#d98a5c', hor: '#ffd9a0', mtn: '#8a6a7a', hills: ['#6a5a48', '#46502f', '#2c3a22'], tree: '#16200f', sun: [w * 0.5, H - 38, 230, 'rgba(255,238,190,1)', 'rgba(255,170,90,0)'] },
        day: { top: '#3f7fd6', mid: '#8fc0f0', hor: '#dcefff', mtn: '#8da3c4', hills: ['#6f9a58', '#4f8a40', '#3a6e30'], tree: '#1f3d1a', sun: [w * 0.62, H - 340, 170, 'rgba(255,255,240,1)', 'rgba(255,255,230,0)'] },
        night: { top: '#03050b', mid: '#0c1530', hor: '#22345c', mtn: '#1a2440', hills: ['#141c30', '#0e1524', '#080d18'], tree: '#04070d', sun: [w * 0.34, H - 300, 120, 'rgba(240,244,255,1)', 'rgba(170,190,255,0)'] },
      }[kind] || {};
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.top); sky.addColorStop(0.65, P.mid); sky.addColorStop(1, P.hor);
      g.fillStyle = sky; g.fillRect(0, 0, w, H + 2);
      if (kind === 'night') for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.8})`; const s = r() < 0.06 ? 2.2 : 1.1; g.fillRect(r() * w, r() * (H - 60), s, s); }
      const [sx, sy, sr, c0, c1] = P.sun;
      const glow = g.createRadialGradient(sx, sy, 2, sx, sy, sr * 2.2); glow.addColorStop(0, c0); glow.addColorStop(0.18, c0); glow.addColorStop(1, c1);
      g.fillStyle = glow; g.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
      if (kind === 'night') { g.fillStyle = '#f2f4ff'; g.beginPath(); g.arc(sx, sy, 34, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(12,21,48,0.85)'; g.beginPath(); g.arc(sx + 14, sy - 8, 30, 0, 6.2832); g.fill(); }
      // clouds
      const blob = (x, y, s, a, col) => { for (let i = 0; i < 9; i++) { const bx = x + (r() - 0.5) * s * 1.6; const by = y + (r() - 0.5) * s * 0.3; const gr = g.createRadialGradient(bx, by, 2, bx, by, s * 0.5); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(bx - s * 0.5, by - s * 0.5, s, s); } };
      const cloudCol = kind === 'night' ? '70,84,128' : kind === 'golden' ? '255,196,150' : '255,255,255';
      for (let i = 0; i < (kind === 'day' ? 26 : 14); i++) blob(r() * w, 60 + r() * (H - 210), 140 + r() * 200, kind === 'night' ? 0.22 : 0.5, cloudCol);
      // far mountains, a haze of them
      const ridge = (base, amp, col, seed2, freq) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const t = (x / w) * Math.PI * 2;
          const y = base - amp * (0.55 + 0.25 * Math.sin(t * freq + seed2) + 0.14 * Math.sin(t * freq * 2.7 + seed2 * 2) + 0.08 * Math.sin(t * freq * 6.1 + seed2 * 3));
          g.lineTo(x, y);
        }
        g.lineTo(w, h); g.closePath(); g.fill();
      };
      ridge(H + 6, 110, P.mtn, 1, 7);
      ridge(H + 40, 70, P.hills[0], 2, 5);
      ridge(H + 90, 60, P.hills[1], 4, 9);
      // a lake in the valley
      const lake = g.createLinearGradient(0, H + 60, 0, H + 150); lake.addColorStop(0, P.hor); lake.addColorStop(1, P.mid);
      g.fillStyle = lake; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(w * 0.28, H + 112, 260, 22, 0, 0, 6.2832); g.ellipse(w * 0.78, H + 120, 200, 18, 0, 0, 6.2832); g.fill(); g.globalAlpha = 1;
      // a village: little roofs with lit windows
      for (let i = 0; i < 46; i++) {
        const x = w * 0.55 + r() * 340; const y = H + 100 + r() * 24; const bw = 12 + r() * 16; const bh = 10 + r() * 14;
        g.fillStyle = kind === 'night' ? '#0a0f1c' : '#5b4b44'; g.fillRect(x, y - bh, bw, bh);
        g.fillStyle = kind === 'night' ? '#0a0f1c' : '#7a3b2c'; g.beginPath(); g.moveTo(x - 2, y - bh); g.lineTo(x + bw / 2, y - bh - 9); g.lineTo(x + bw + 2, y - bh); g.fill();
        if (kind === 'night' && r() < 0.6) { g.fillStyle = '#ffd37a'; g.fillRect(x + 3, y - bh + 3, 3, 3); }
      }
      ridge(H + 150, 50, P.hills[2], 6, 11);
      // forest edge and single trees
      for (let i = 0; i < 360; i++) {
        const x = (i / 360) * w + r() * 8; const base = H + 170 + r() * 150; const hh = 38 + r() * 90; const ww = 14 + r() * 26;
        g.fillStyle = P.tree; g.beginPath(); g.moveTo(x, base); g.lineTo(x - ww / 2, base); g.quadraticCurveTo(x - ww * 0.45, base - hh * 0.6, x, base - hh); g.quadraticCurveTo(x + ww * 0.45, base - hh * 0.6, x + ww / 2, base); g.fill();
      }
      g.fillStyle = P.tree; g.fillRect(0, H + 300, w, H);
      if (kind === 'golden') { const fog = g.createLinearGradient(0, H - 30, 0, H + 120); fog.addColorStop(0, 'rgba(255,214,160,0)'); fog.addColorStop(0.5, 'rgba(255,200,140,0.35)'); fog.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = fog; g.fillRect(0, H - 30, w, 150); }
    });
    return texOf(c, { repeat: false });
  });
}

// ───────── the book in your hand ─────────
export function coverCanvas(book, design) {
  const W = 256; const H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, design.bg); grd.addColorStop(1, design.bg);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = design.accent; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 1; g.strokeRect(22, 22, W - 44, H - 44);
  g.fillStyle = design.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = book.title.split(/\s+/);
  const lines = []; let cur = '';
  g.font = '700 30px "Fraunces", Georgia, serif';
  for (const wd of words) { const t = cur ? `${cur} ${wd}` : wd; if (g.measureText(t).width > W - 70 && cur) { lines.push(cur); cur = wd; } else cur = t; }
  lines.push(cur);
  lines.slice(0, 5).forEach((ln, i, a) => g.fillText(ln, W / 2, H * 0.4 + (i - (a.length - 1) / 2) * 38));
  g.fillStyle = design.accent; g.fillRect(W / 2 - 30, H * 0.62, 60, 3);
  g.fillStyle = design.fg; g.font = '600 17px "DM Sans", Helvetica, sans-serif';
  g.fillText((book.authors[0] || '').toUpperCase(), W / 2, H * 0.72);
  return c;
}
