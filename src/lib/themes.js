// Visuals for every wallpaper and wood finish the reader can pick. Textures are generated as small SVG
// images (fractal noise stretched and tinted), so there are no image files to download and any colour works.
import { WALLPAPERS, WOODS } from '../../shared/options.js';

const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const f = (n) => Number(n.toFixed(3));

/** Fractal noise tinted between two colours. fx/fy set the stretch: wide fx/narrow fy gives horizontal grain. */
function noiseTile({ w, h, fx, fy, light, dark, octaves = 4, seed = 3, contrast = 2.2, pores = 0 }) {
  const [lr, lg, lb] = rgb(light);
  const [dr, dg, db] = rgb(dark);
  // out = dark + (light - dark) * clamp(contrast * (noise - 0.5) + 0.5)
  const row = (l, d) => `${f((l - d) * contrast)} 0 0 0 ${f(d + (l - d) * (0.5 - 0.5 * contrast))}`;
  const matrix = `${row(lr, dr)} ${row(lg, dg)} ${row(lb, db)} 0 0 0 0 1`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix values="${matrix}"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#g)"/>
    ${pores ? `<filter id="p" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fx * 2.5} ${fy * 5}" numOctaves="2" seed="${seed + 7}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.7 0 0 0 -0.62"/></filter><rect width="100%" height="100%" filter="url(#p)" opacity="${pores}"/>` : ''}
  </svg>`;
}

// ───────── wood ─────────
const WOOD = {
  mahogany:   { label: 'Mahogany',   light: '#9a4b2b', dark: '#35130a', seed: 17, inlay: '#ead59c' },
  walnut:     { label: 'Walnut',     light: '#8a5a37', dark: '#3c2213', seed: 4, inlay: '#e8d39b' },
  oak:        { label: 'Oak',        light: '#d2a468', dark: '#946a38', seed: 9, inlay: '#4a2f14' },
  cherry:     { label: 'Cherry',     light: '#b25a36', dark: '#5f2614', seed: 12, inlay: '#ecd6a0' },
  teak:       { label: 'Honey teak', light: '#c4863f', dark: '#74431a', seed: 21, inlay: '#f0dfae' },
  ebony:      { label: 'Ebony',      light: '#4b423d', dark: '#16110f', seed: 6, inlay: '#d8b66a' },
  whitewash:  { label: 'Whitewash',  light: '#ece3d3', dark: '#b8aa92', seed: 15, inlay: '#6a5a44' },
  driftwood:  { label: 'Driftwood',  light: '#a8a196', dark: '#625c53', seed: 30, inlay: '#e6dcc4' },
};
const woodCache = new Map();

/** CSS variables for one wood: a horizontal grain (shelf boards) and a vertical one (side panels). */
export function woodVars(id) {
  if (woodCache.has(id)) return woodCache.get(id);
  const w = WOOD[id] || WOOD.walnut;
  const common = { light: w.light, dark: w.dark, seed: w.seed, octaves: 4, pores: 0.45 };
  const vars = {
    '--wood-h': svgUrl(noiseTile({ ...common, w: 900, h: 56, fx: 0.0035, fy: 0.085 })),
    '--wood-v': svgUrl(noiseTile({ ...common, w: 56, h: 900, fx: 0.085, fy: 0.0035 })),
    // burr / figured grain for the cabinet panels and frieze, which swirls in both directions
    '--wood-fig': svgUrl(noiseTile({ ...common, w: 640, h: 420, fx: 0.016, fy: 0.045, octaves: 5, pores: 0.3, contrast: 2.6 })),
    '--wood-inlay': w.inlay,
    '--wood-light': w.light,
    '--wood-dark': w.dark,
  };
  woodCache.set(id, vars);
  return vars;
}
export const woodLabel = (id) => (WOOD[id] || WOOD.walnut).label;
export const woodSwatch = (id) => ({ ...woodVars(id), backgroundImage: 'var(--wood-h)', backgroundSize: 'auto 100%' });

// ───────── walls ─────────
const leafTile = (bg, leaf) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="${bg}"/>
  <g fill="${leaf}" stroke="${bg}" stroke-width="1.2" opacity=".92">
  ${[[50, 60, -20, 1], [170, 40, 35, .85], [120, 130, 160, 1.05], [40, 180, 80, .8], [200, 190, -60, 1], [130, 220, 20, .7]].map(([x, y, r, s]) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0 C-22 -16 -26 -52 0 -78 C26 -52 22 -16 0 0Z"/><path d="M0 -4 L0 -70" fill="none" stroke="${bg}" stroke-width="1.4"/><path d="M0 -20 L-12 -34 M0 -20 L12 -34 M0 -38 L-13 -52 M0 -38 L13 -52" fill="none" stroke="${bg}" stroke-width=".9"/></g>`).join('')}
  </g></svg>`;

function brickTile() {
  const shades = ['#7b3d2e', '#8a4632', '#6d3326', '#84412f', '#743729', '#8f4b35', '#6a3024'];
  let bricks = '';
  let n = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col < 3; col++) {
      const x = col * 80 + (row % 2 ? 40 : 0) + 2;
      bricks += `<rect x="${x}" y="${row * 20 + 2}" width="76" height="16" rx="1.5" fill="${shades[(n++ * 3 + row) % shades.length]}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80">
    <filter id="t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="8" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .9 0 0 0 -.25"/></filter>
    <rect width="160" height="80" fill="#3a2e29"/>${bricks}<rect width="160" height="80" filter="url(#t)" opacity=".5"/></svg>`;
}
const shiplapTile = () => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="46" viewBox="0 0 120 46">
  <filter id="t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .5" numOctaves="3" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .8 0 0 0 -.2"/></filter>
  <rect width="120" height="46" fill="#c9bfae"/><rect width="120" height="46" filter="url(#t)" opacity=".35"/>
  <rect y="42" width="120" height="4" fill="#6f6556"/><rect y="40" width="120" height="2" fill="rgba(0,0,0,.12)"/><rect y="0" width="120" height="1.5" fill="rgba(255,255,255,.35)"/></svg>`;

const SOLID = (color, glow = 0.05) => ({
  backgroundColor: color,
  backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,${glow}), transparent 70%)`,
});

const WALLS = {
  forest:     { label: 'Forest',     style: () => SOLID('#1e2c24') },
  navy:       { label: 'Midnight',   style: () => SOLID('#17222f') },
  aubergine:  { label: 'Aubergine',  style: () => SOLID('#2b1c2c') },
  clay:       { label: 'Clay',       style: () => SOLID('#4c2c20', 0.07) },
  charcoal:   { label: 'Charcoal',   style: () => SOLID('#262828') },
  linen:      { label: 'Linen',      style: () => SOLID('#b8aa8d', 0.12) },
  botanical:  { label: 'Botanical',  style: () => ({ backgroundColor: '#1d2c23', backgroundImage: svgUrl(leafTile('#1b2a21', '#25402f')), backgroundSize: '240px 240px' }) },
  pinstripe:  { label: 'Pinstripe',  style: () => ({ backgroundColor: '#1b2431', backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 25px, rgba(255,255,255,.09) 25px 27px, transparent 27px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 28px, transparent 28px 56px)' }) },
  grasscloth: { label: 'Grasscloth', style: () => ({ backgroundColor: '#5d6b4f', backgroundImage: svgUrl(noiseTile({ w: 400, h: 400, fx: 0.003, fy: 0.9, light: '#93a37d', dark: '#3b4631', octaves: 3, seed: 2 })), backgroundSize: '400px 400px' }) },
  brick:      { label: 'Brick',      style: () => ({ backgroundColor: '#3a2e29', backgroundImage: svgUrl(brickTile()), backgroundSize: '160px 80px' }) },
  shiplap:    { label: 'Shiplap',    style: () => ({ backgroundColor: '#c9bfae', backgroundImage: svgUrl(shiplapTile()), backgroundSize: '120px 46px' }) },
};
const wallCache = new Map();
export function wallpaperStyle(id) {
  if (!wallCache.has(id)) wallCache.set(id, (WALLS[id] || WALLS.forest).style());
  return wallCache.get(id);
}
export const wallpaperLabel = (id) => (WALLS[id] || WALLS.forest).label;

// ───────── light ─────────
// edge = how dark the room is away from the lamp; glow = the lamp's warm pool.
export const LIGHT = {
  low:    { label: 'Candlelit', '--dim-edge': 0.72, '--dim-mid': 0.3, '--glow': 0.2 },
  medium: { label: 'Evening',   '--dim-edge': 0.5,  '--dim-mid': 0.16, '--glow': 0.15 },
  bright: { label: 'Daylight',  '--dim-edge': 0.2,  '--dim-mid': 0.04, '--glow': 0.08 },
};

export const DECOR_LABELS = { full: 'Furnished', plants: 'Plants only', none: 'Bare' };
export const FILL_LABELS = { stocked: 'Decorated with books', mine: 'Empty: just my books' };
export { WALLPAPERS, WOODS };
