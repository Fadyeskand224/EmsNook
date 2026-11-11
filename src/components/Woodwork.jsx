// The bookcase itself, in the manner of a Victorian Gothic library case: a pierced tracery crest with pinnacles and
// finials, a stepped cornice (egg-and-dart, dentils, burr frieze with paterae), fluted pilasters with carved capitals,
// scalloped aprons, and a plinth with arched raised-panel doors, brass fittings and bracket feet.
// Everything takes its colour and grain from the chosen wood (CSS variables), and carved parts are lit from the top left.

/** Filters shared by every carved part. Render once near the root. */
export function WoodDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* relief: blur the shape's edge into a height map and light it from the top left */}
        <filter id="ww-carve" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.7" result="h" />
          <feDiffuseLighting in="h" surfaceScale="5" diffuseConstant="1.15" lightingColor="#ffffff" result="d">
            <feDistantLight azimuth="235" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="d" in2="SourceAlpha" operator="in" result="dIn" />
          <feBlend in="SourceGraphic" in2="dIn" mode="multiply" result="lit" />
          <feSpecularLighting in="h" surfaceScale="5" specularConstant="0.7" specularExponent="22" lightingColor="#fff0d2" result="s">
            <feDistantLight azimuth="235" elevation="55" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="sIn" />
          <feComposite in="sIn" in2="lit" operator="arithmetic" k1="0" k2="0.85" k3="1" k4="0" />
        </filter>
        {/* grain for carved parts: dark streaks in the chosen wood's dark tone */}
        <filter id="ww-grain" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.3" numOctaves="3" seed="5" result="n" />
          <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.9 0 0 0 -0.62" result="a" />
          <feFlood style={{ floodColor: 'var(--wood-dark)' }} result="c" />
          <feComposite in="c" in2="a" operator="in" />
        </filter>
        <linearGradient id="ww-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>

        {/* the pierced Gothic crest: solid outline in white, openings in black */}
        <mask id="ww-crest" maskUnits="userSpaceOnUse" x="0" y="-40" width="440" height="134">
          <g fill="#fff">
            <path d="M0 90 V46 H100 C122 46 128 34 148 26 C170 17 196 20 220 6 C244 20 270 17 292 26 C312 34 318 46 340 46 H440 V90 Z" />
            {[[132, 31], [150, 24], [172, 19], [196, 15], [244, 15], [268, 19], [290, 24], [308, 31]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.4" />)}
            {/* pinnacles and finials */}
            {[0, 1].map((m) => (
              <g key={m} transform={m ? 'translate(440 0) scale(-1 1)' : undefined}>
                <rect x="2" y="-8" width="14" height="56" />
                <path d="M0 -8 L9 -22 L18 -8 Z" /><circle cx="9" cy="-26" r="4" /><rect x="-1" y="44" width="20" height="5" rx="1.5" />
              </g>
            ))}
            <path d="M213 8 L220 -16 L227 8 Z" /><circle cx="220" cy="-21" r="5.5" /><rect x="212" y="4" width="16" height="5" rx="2" /><circle cx="220" cy="-10" r="3.4" />
          </g>
          <g fill="#000">
            {[0, 1].map((m) => (
              <g key={m} transform={m ? 'translate(440 0) scale(-1 1)' : undefined}>
                {[0, 1, 2, 3].map((i) => {
                  const x = 10 + i * 23;
                  return <path key={i} d={`M${x} 84 V66 Q${x} 55 ${x + 9} 49 Q${x + 18} 55 ${x + 18} 66 V84 Z`} />;
                })}
                <path d="M128 82 V68 Q128 60 134 55 Q140 60 140 68 V82 Z" />
                <path d="M166 82 V64 Q166 52 173 44 Q180 52 180 64 V82 Z" />
              </g>
            ))}
            <circle cx="212" cy="52" r="10" /><circle cx="228" cy="52" r="10" /><circle cx="220" cy="44" r="10" /><circle cx="220" cy="60" r="10" /><circle cx="220" cy="27" r="4.6" />
          </g>
        </mask>

        {/* carved capital for the pilasters: abacus, bell, and volutes */}
        <mask id="ww-capital" maskUnits="userSpaceOnUse" x="0" y="0" width="56" height="36">
          <g fill="#fff">
            <rect x="0" y="0" width="56" height="7" rx="1" /><rect x="3" y="7" width="50" height="3" />
            <path d="M11 10 C8 22 12 30 16 36 H40 C44 30 48 22 45 10 Z" />
            <circle cx="9" cy="14" r="8" /><circle cx="47" cy="14" r="8" />
          </g>
          <g fill="none" stroke="#000" strokeLinecap="round">
            <path d="M28 12 V36 M21 14 Q18 24 22 34 M35 14 Q38 24 34 34" strokeWidth="1.6" />
            <path d="M6 14 a3 3 0 1 1 3 3 M50 14 a3 3 0 1 0 -3 3" strokeWidth="1.5" />
            <path d="M16 22 Q22 20 26 26 M40 22 Q34 20 30 26" strokeWidth="1.2" />
          </g>
          <circle cx="9" cy="14" r="1.6" fill="#000" /><circle cx="47" cy="14" r="1.6" fill="#000" />
        </mask>

        {/* paterae (rosettes) */}
        <mask id="ww-rosette" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <g fill="#fff">{Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx="16" cy="5.5" rx="2.8" ry="6" transform={`rotate(${i * 30} 16 16)`} />)}<circle cx="16" cy="16" r="9" /></g>
          <circle cx="16" cy="16" r="3.4" fill="#000" /><circle cx="16" cy="16" r="6.2" fill="none" stroke="#000" strokeWidth="1" />
        </mask>

        {/* bracket foot */}
        <mask id="ww-foot" maskUnits="userSpaceOnUse" x="0" y="0" width="76" height="34">
          <path fill="#fff" d="M0 0 H76 V7 C76 7 64 11 60 20 C57 27 63 34 63 34 H13 C13 34 19 27 16 20 C12 11 0 7 0 7 Z" />
          <path fill="none" stroke="#000" strokeWidth="1.4" d="M20 12 C27 15 29 22 26 28 M56 12 C49 15 47 22 50 28" />
        </mask>
      </defs>
    </svg>
  );
}

/** One carved part: wood colour, grain, then the lighting filter, cut to a mask. */
function Carved({ mask, w, h, viewBox, className = '' }) {
  return (
    <svg className={`carved ${className}`} viewBox={viewBox || `0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" style={{ overflow: 'visible' }}>
      <g filter="url(#ww-carve)">
        <g mask={`url(#${mask})`}>
          <rect x="-40" y="-60" width={w + 80} height={h + 120} style={{ fill: 'var(--wood-light)' }} />
          <rect x="-40" y="-60" width={w + 80} height={h + 120} filter="url(#ww-grain)" />
          <rect x="-40" y="-60" width={w + 80} height={h + 120} fill="url(#ww-shade)" />
        </g>
      </g>
    </svg>
  );
}

export const Rosette = ({ size = 26, className = '' }) => <span className={`rosette ${className}`} style={{ width: size, height: size }}><Carved mask="ww-rosette" w={32} h={32} /></span>;

/** Crest, then the stepped cornice. */
export function Cornice({ crest = true }) {
  return (
    <div className="cornice" aria-hidden="true">
      {crest && <div className="crest"><Carved mask="ww-crest" w={440} h={134} viewBox="0 -40 440 134" className="crest-svg" /></div>}
      <div className="c-cap" />
      <div className="c-egg" />
      <div className="c-dentil" />
      <div className="c-frieze">
        <Rosette className="r-l" /><Rosette className="r-r" />
        <span className="inlay in-t" /><span className="inlay in-b" />
      </div>
    </div>
  );
}

export function Pilaster({ side }) {
  return (
    <div className={`pilaster ${side}`} aria-hidden="true">
      <div className="capital"><Carved mask="ww-capital" w={56} h={36} /></div>
      <div className="shaft" />
      <div className="plinth" />
    </div>
  );
}

/** The scalloped skirt that hangs under each shelf. */
export function Apron() {
  return (
    <div className="apron" aria-hidden="true">
      <i className="apron-drop" />
      <Rosette size={16} className="ap-1" /><Rosette size={16} className="ap-2" /><Rosette size={16} className="ap-3" />
    </div>
  );
}

/** Plinth cabinet: moulded top, two arched raised-panel doors (book-matched), brass fittings, bracket feet. */
export function Base() {
  return (
    <div className="base" aria-hidden="true">
      <div className="b-top" />
      <div className="b-body">
        {[0, 1].map((d) => (
          <div className={`door ${d ? 'mirror' : ''}`} key={d}>
            <div className="panel">
              <i className="inlay-arch" />
              <span className={`knob ${d ? 'k-l' : 'k-r'}`} />
              {d === 1 && (
                <svg className="escutcheon" viewBox="0 0 20 30" width="20" height="30">
                  <path d="M10 1 C16 1 19 5 19 11 C19 17 15 20 14 29 H6 C5 20 1 17 1 11 C1 5 4 1 10 1Z" fill="url(#brass)" stroke="#3a2808" strokeWidth=".7" />
                  <circle cx="10" cy="12" r="2.4" fill="#120c04" /><path d="M8.6 13 H11.4 L12 21 H8 Z" fill="#120c04" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="b-skirt" />
      <span className="foot f-l"><Carved mask="ww-foot" w={76} h={34} /></span>
      <span className="foot f-r"><Carved mask="ww-foot" w={76} h={34} /></span>
    </div>
  );
}
