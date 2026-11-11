// The room around the shelves, after a grand reading room: coffered ceiling with tall windows and slanting light,
// a chandelier, an upper gallery behind a turned balustrade, and a furnished floor. The furniture is photographed
// (see lib/plantCredits.js); the architecture is built from the same wood as the bookcase.
import { Fragment, memo } from 'react';
import assets from '../lib/libraryAssets.json';
import { makeFiller } from '../lib/filler';
import { SpineFace } from './Book';
import { Stack } from './Plants';

const IMG = Object.fromEntries(assets.map((a) => [a.id, `/library/${a.file}`]));

function Filler({ item, scale }) {
  if (item.kind === 'stack') return <span className="f-stack" style={{ width: 76 * scale, height: 58 * scale }}><Stack /></span>;
  const d = item.design;
  return (
    <span className={`filler ${item.kind === 'lean' ? 'lean' : ''}`} style={{ width: d.width * scale, height: d.height * scale, marginRight: 2 * scale }}>
      <i className="cap" />
      <span className="spine-scale" style={{ transform: `scale(${scale})` }}><SpineFace book={item.book} design={d} /></span>
    </span>
  );
}

/** Decorative volumes filling `space` screen pixels at the given zoom. */
export const FillerRun = memo(function FillerRun({ seed, space, scale }) {
  if (space < 24 * scale) return null;
  return makeFiller(seed, space / scale).map((item, i) => <Filler key={i} item={item} scale={scale} />);
});

export function Ceiling() {
  return (
    <div className="ceiling" aria-hidden="true">
      <div className="windows">{[0, 1, 2, 3, 4].map((i) => <i className="win" key={i} />)}</div>
      <div className="ceil-cornice" />
    </div>
  );
}

export function Chandelier() {
  return (
    <>
      <div className="chandelier-glow" aria-hidden="true" />
      <div className="chandelier-wrap" aria-hidden="true"><img className="chandelier" src={IMG.chandelier} alt="" draggable="false" /></div>
    </>
  );
}

export function Rays() {
  return (
    <div className="rays" aria-hidden="true">
      {[[14, -27, 0.34, 0], [31, -20, 0.26, -3], [50, -32, 0.32, -6], [68, -23, 0.24, -2], [84, -29, 0.3, -8]].map(([x, a, o, d], i) => (
        <i key={i} className="ray" style={{ left: `${x}%`, '--a': `${a}deg`, '--o': o, animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

/** The upper gallery: a row of shelves behind a turned balustrade. Bays line up with the ones below. */
export function Gallery({ nBays, bayPx, divPx }) {
  return (
    <div className="gallery" aria-hidden="true">
      <i className="g-shade" />
      <div className="g-row">
        {Array.from({ length: nBays }, (_, b) => (
          <Fragment key={b}>
            {b > 0 && <i className="divider g-div" style={{ width: divPx }} />}
            <div className="bay g-bay" style={{ width: bayPx }}><FillerRun seed={100 + b} space={bayPx} scale={0.74} /></div>
          </Fragment>
        ))}
      </div>
      <div className="g-plank" />
      <div className="balustrade"><i className="handrail" /><i className="balusters" /><i className="baserail" /></div>
      <i className="g-post shaft l" /><i className="g-post shaft r" />
    </div>
  );
}

/** A rolling library ladder, leaning on the left of the case. It is sized from the bookcase height, so it scales with zoom. */
export function Ladder() {
  return (
    <div className="ladder" aria-hidden="true">
      <i className="hook" />
      <i className="rail l" /><i className="rail r" />
      <span className="rungs">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
      <i className="foot l" /><i className="foot r" />
    </div>
  );
}

/** Dark boards receding into the room under the bookcase. The floor is a plain 3D plane: nothing flat is pasted on it. */
export function Floor() {
  return (
    <div className="floor" aria-hidden="true">
      <div className="floor-bed"><div className="floor-plane" /></div>
      <i className="floor-fade" />
    </div>
  );
}
