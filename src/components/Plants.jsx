// Shelf decorations. The plants are real photographs, cut out from their backgrounds (see lib/plantCredits.js).
// The candles and the book stack are drawn; render <PlantDefs /> once near the root for their gradients.
import manifest from '../lib/plantManifest.json';

export function PlantDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cdb892" /><stop offset=".35" stopColor="#fff3da" /><stop offset=".7" stopColor="#eadbb9" /><stop offset="1" stopColor="#bfa77c" />
        </linearGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7d5a1e" /><stop offset=".4" stopColor="#e6c06a" /><stop offset=".6" stopColor="#b8893a" /><stop offset="1" stopColor="#6b4a14" />
        </linearGradient>
        <radialGradient id="flame" cx="50%" cy="68%" r="60%">
          <stop offset="0" stopColor="#fffbe8" /><stop offset=".35" stopColor="#ffd77a" /><stop offset=".75" stopColor="#ff9d2e" /><stop offset="1" stopColor="#e2561a" stopOpacity=".2" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffcf86" stopOpacity=".6" /><stop offset="1" stopColor="#ffcf86" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
    </svg>
  );
}

export function Candles({ className = '' }) {
  const candles = [[26, 52, 76, 0.2], [60, 34, 94, 0.6]]; // x, flame y, height, flicker delay
  return (
    <svg className={`candles ${className}`} viewBox="0 0 90 126" width="90" height="126" aria-hidden="true" style={{ overflow: 'visible' }}>
      <ellipse cx="45" cy="122" rx="40" ry="4" fill="#000" opacity=".5" filter="url(#soft)" />
      {candles.map(([x, fy, h, delay], i) => (
        <g key={i}>
          <circle className="halo" cx={x} cy={fy} r="46" fill="url(#glow)" />
          <ellipse cx={x} cy="120" rx="14" ry="3.6" fill="url(#brass)" />
          <rect x={x - 5} y={122 - h - 2} width="10" height={h} rx="1" fill="url(#wax)" />
          <ellipse cx={x} cy={122 - h - 2} rx="5" ry="1.6" fill="#fff6e2" />
          <path d={`M${x + 3} ${122 - h} q2 8 0 15 q-3 -7 0 -15`} fill="#fff1d4" opacity=".9" />
          <rect x={x - 5} y={122 - h - 2} width="3" height={h} fill="#fff" opacity=".18" />
          <path d={`M${x} ${122 - h - 2} v-4`} stroke="#2a1a10" strokeWidth=".9" />
          <g className="flame" style={{ animationDelay: `${delay}s` }}>
            <path d={`M${x} ${fy - 9} C${x + 5} ${fy - 2} ${x + 4} ${fy + 7} ${x} ${fy + 7} C${x - 4} ${fy + 7} ${x - 5} ${fy - 2} ${x} ${fy - 9}Z`} fill="url(#flame)" transform={`translate(0 ${122 - h - 2 - 4 - (fy + 7)})`} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Books lying flat. */
export function Stack({ className = '' }) {
  const books = [['#6f2a22', 118], ['#26402f', 104], ['#b8934d', 112]];
  return (
    <svg className={`stack ${className}`} viewBox="0 0 130 100" width="130" height="100" aria-hidden="true">
      <ellipse cx="65" cy="97" rx="58" ry="4.5" fill="#000" opacity=".55" filter="url(#soft)" />
      {books.map(([c, w], i) => {
        const y = 94 - (i + 1) * 21;
        return (
          <g key={i} transform={`translate(${(130 - w) / 2 + (i === 1 ? 6 : -3)} ${y})`}>
            <rect y="1" width={w} height="20" rx="2" fill="#000" opacity=".25" />
            <rect width={w} height="20" rx="2" fill={c} />
            <rect x="3.5" y="3" width={w - 7} height="14" fill="#efe1c4" />
            {[5, 7.5, 10, 12.5, 15].map((yy) => <line key={yy} x1="4" x2={w - 4} y1={yy} y2={yy} stroke="#c9b48c" strokeWidth=".5" />)}
            <rect width="8" height="20" rx="2" fill="#000" opacity=".3" />
            <rect y="0" width={w} height="2" rx="1" fill="#fff" opacity=".18" />
            <rect x="1" y="4" width="6" height="1.4" fill="#e2c37a" opacity=".85" /><rect x="1" y="14" width="6" height="1.4" fill="#e2c37a" opacity=".85" />
          </g>
        );
      })}
    </svg>
  );
}

// Design size at zoom 1 (CSS px) for each decoration; the shelf reserves this much room for it.
const PHOTOS = Object.fromEntries(manifest.map((m) => [m.id, { w: m.w, h: m.h, plant: true, hang: m.kind === 'hang', src: `/plants/${m.file}` }]));
export const DECOR_META = { ...PHOTOS, candles: { w: 90, h: 126, plant: false }, stack: { w: 130, h: 100, plant: false }, lamp: { w: 100, h: 154, plant: false, glow: true, src: '/library/lamp-amber.webp' } };
export const DECOR = ['monstera', 'hang-philo', 'rubber', 'lamp', 'candles', 'strelitzia', 'hang-pothos', 'snake-terra', 'stack', 'philo-dark', 'haworthia', 'snake-white', 'snake-grey'];

export function Decor({ kind }) {
  const meta = DECOR_META[kind];
  if (meta?.src) return <img src={meta.src} alt="" draggable="false" decoding="async" />;
  if (kind === 'candles') return <Candles />;
  if (kind === 'stack') return <Stack />;
  return null;
}
