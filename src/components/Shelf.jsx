import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SpineFace } from './Book';
import { Decor, DECOR, DECOR_META } from './Plants';
import { spineDesign } from '../lib/spine';
import { packBays } from '../lib/filler';
import { percentOf } from '../lib/progress';
import { mergeOrder, shelfSort } from '../lib/shelfOrder';
import { LIGHT, wallpaperStyle, woodVars } from '../lib/themes';
import { usePalettes } from '../lib/coverColors';
import { Apron, Base, Cornice, Pilaster } from './Woodwork';
import { Ceiling, Chandelier, FillerRun, Floor, Gallery, Ladder, Rays } from './Scenery';

const MIN_ROWS = 4;
const ROW_H = 224; // tallest decoration at zoom 1
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Decorations take room from the books. On a narrow screen they appear less often and stay small.
function decorFor(i, mode, narrow) {
  const every = narrow ? 3 : 1;
  if (mode === 'none' || i % every !== 0) return null;
  let list = mode === 'plants' ? DECOR.filter((k) => DECOR_META[k].plant) : DECOR;
  if (narrow) list = list.filter((k) => DECOR_META[k].w <= 130 && !DECOR_META[k].hang);
  return list[Math.floor(i / every) % list.length];
}

export default function Shelf({ books, hiddenId, settings, onOpen, onFind, onCustomize, onReorder, onRoom }) {
  const [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState(() => (window.innerWidth < 600 ? 0.95 : 1));
  const [lamp, setLamp] = useState(() => !window.matchMedia?.('(hover: none)').matches);
  const [width, setWidth] = useState(900);
  const [dragId, setDragId] = useState(null);
  const [override, setOverride] = useState(null); // live order while a book is being dragged
  const roomRef = useRef(null);
  const unitRef = useRef(null);
  const ghostRef = useRef(null);
  const drag = useRef(null);
  const justDragged = useRef(false);

  usePalettes(books);
  const allSorted = useMemo(() => shelfSort(books), [books]);
  const allIds = useMemo(() => allSorted.map((b) => b.id), [allSorted]);
  const baseShown = useMemo(() => allSorted.filter((b) => filter === 'all' || b.status === filter), [allSorted, filter]);
  const byId = useMemo(() => new Map(allSorted.map((b) => [b.id, b])), [allSorted]);
  const shown = override ? override.map((id) => byId.get(id)).filter(Boolean) : baseShown;
  const counts = { reading: allSorted.filter((b) => b.status === 'reading').length, read: allSorted.filter((b) => b.status === 'read').length };

  // Measure the room a row of books can actually use (the rows' own padding and the side panels excluded).
  useEffect(() => {
    const measure = () => {
      const row = unitRef.current?.querySelector('.row');
      if (!row) return;
      const cs = getComputedStyle(row);
      setWidth(row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      // the ladder always leans the same distance (about its own width) however tall the case grows
      const h = unitRef.current.clientHeight;
      if (h) unitRef.current.style.setProperty('--lean', `${(Math.atan(Math.min(52, h * 0.05) / h) * 180 / Math.PI).toFixed(2)}deg`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(unitRef.current);
    return () => ro.disconnect();
  }, []);

  // Zoom with the slider, ctrl/pinch on a trackpad, or two fingers on a touch screen.
  useEffect(() => {
    const room = roomRef.current;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * (1 - e.deltaY * 0.012), MIN_ZOOM, MAX_ZOOM));
    };
    let dist = 0;
    const span = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = span(e.touches);
        if (dist) setZoom((z) => clamp(z * (d / dist), MIN_ZOOM, MAX_ZOOM));
        dist = d;
      } else {
        dist = 0;
        if (drag.current?.active) e.preventDefault(); // a dragged book must not scroll the page
      }
    };
    const onTouchEnd = () => (dist = 0);
    const noGesture = (e) => e.preventDefault(); // Safari's own pinch-zoom
    room.addEventListener('wheel', onWheel, { passive: false });
    room.addEventListener('touchmove', onTouchMove, { passive: false });
    room.addEventListener('touchend', onTouchEnd);
    room.addEventListener('gesturestart', noGesture);
    room.addEventListener('gesturechange', noGesture);
    return () => {
      room.removeEventListener('wheel', onWheel);
      room.removeEventListener('touchmove', onTouchMove);
      room.removeEventListener('touchend', onTouchEnd);
      room.removeEventListener('gesturestart', noGesture);
      room.removeEventListener('gesturechange', noGesture);
    };
  }, []);

  // The lamp and the slight wall parallax. Pointer moves are batched to one write per frame and go straight to the
  // two elements that use them, so moving the mouse never restyles the thousands of spines and carvings.
  const wallRef = useRef(null);
  const dimRef = useRef(null);
  const frame = useRef(0);
  const pending = useRef(null);
  const flush = () => {
    frame.current = 0;
    const p = pending.current;
    if (!p) return;
    const { x, y, w, h } = p;
    if (wallRef.current) wallRef.current.style.transform = `translate3d(${(-(x / w * 2 - 1) * 14).toFixed(1)}px, ${(-(y / h * 2 - 1) * 9).toFixed(1)}px, 0)`;
    if (lamp && dimRef.current) {
      dimRef.current.style.setProperty('--mx', `${x.toFixed(0)}px`);
      dimRef.current.style.setProperty('--my', `${y.toFixed(0)}px`);
    }
  };
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch' || drag.current?.active) return;
    const r = roomRef.current.getBoundingClientRect();
    pending.current = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    if (!frame.current) frame.current = requestAnimationFrame(flush);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // ───────── drag to rearrange ─────────
  // Mouse: press and move. Touch: press and hold, then move (so scrolling still works). Alt+arrows on a focused spine.
  const targetOrder = (s, x, y) => {
    const el = document.elementFromPoint(x, y);
    const without = s.order.filter((id) => id !== s.id);
    const spine = el?.closest?.('[data-spine-id]');
    let at = null;
    if (spine) {
      const tid = Number(spine.dataset.spineId);
      if (tid === s.id) return s.order;
      const r = spine.getBoundingClientRect();
      at = without.indexOf(tid) + (x > r.left + r.width / 2 ? 1 : 0);
    } else {
      const row = el?.closest?.('.row');
      if (!row) return s.order;
      const ids = [...row.querySelectorAll('[data-spine-id]')].map((n) => Number(n.dataset.spineId)).filter((id) => id !== s.id);
      if (!ids.length) at = without.length; // an empty shelf: the book goes to the end
      else {
        const first = row.querySelector(`[data-spine-id="${ids[0]}"]`).getBoundingClientRect();
        const last = row.querySelector(`[data-spine-id="${ids[ids.length - 1]}"]`).getBoundingClientRect();
        if (x < first.left) at = without.indexOf(ids[0]);
        else if (x > last.right) at = without.indexOf(ids[ids.length - 1]) + 1;
        else return s.order;
      }
    }
    const next = [...without.slice(0, at), s.id, ...without.slice(at)];
    return next.every((id, i) => id === s.order[i]) ? s.order : next;
  };

  const onSpineDown = (e, book) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const s = {
      id: book.id, book, type: e.pointerType, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, h: rect.height,
      active: false, order: baseShown.map((b) => b.id), startOrder: baseShown.map((b) => b.id), timer: null, raf: 0,
    };
    drag.current = s;

    const tick = () => {
      if (!s.active) return;
      if (s.y < 90) window.scrollBy(0, -Math.ceil((90 - s.y) / 5));
      else if (s.y > window.innerHeight - 90) window.scrollBy(0, Math.ceil((s.y - (window.innerHeight - 90)) / 5));
      const next = targetOrder(s, s.x, s.y);
      if (next !== s.order) {
        s.order = next;
        setOverride(next);
      }
      s.raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      s.active = true;
      setDragId(s.id);
      document.body.classList.add('dragging-book');
      navigator.vibrate?.(12);
      s.raf = requestAnimationFrame(tick);
    };
    const place = () => {
      if (ghostRef.current) ghostRef.current.style.transform = `translate(${s.x - s.offX}px, ${s.y - s.offY}px) scale(1.07) rotate(-2.5deg)`;
    };
    const move = (ev) => {
      s.x = ev.clientX;
      s.y = ev.clientY;
      const far = Math.hypot(s.x - s.startX, s.y - s.startY);
      if (!s.active) {
        if (s.type === 'mouse' && far > 6) begin();
        else if (s.type !== 'mouse' && far > 10) finish(false); // the finger is scrolling instead
        return;
      }
      place();
    };
    const finish = (commit) => {
      clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.body.classList.remove('dragging-book');
      if (s.active) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 60);
        if (commit && s.order.some((id, i) => id !== s.startOrder[i])) onReorder(mergeOrder(allIds, s.order));
        setDragId(null);
        setOverride(null);
      }
      s.active = false;
      drag.current = null;
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    if (s.type !== 'mouse') s.timer = setTimeout(begin, 330);
    s.place = place;
  };

  useLayoutEffect(() => {
    if (dragId && drag.current) drag.current.place();
  }, [dragId]);
  useEffect(() => () => document.body.classList.remove('dragging-book'), []);

  const onSpineKey = (e, book) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const order = baseShown.map((b) => b.id);
    const i = order.indexOf(book.id);
    const j = i + (e.key === 'ArrowLeft' ? -1 : 1);
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    onReorder(mergeOrder(allIds, order));
  };

  const mode = settings.decor;
  const narrow = width < 520;
  const stocked = settings.fill === 'stocked';
  const designs = shown.map((book) => ({ book, ...spineDesign(book) }));
  const reserve = (i) => {
    const kind = decorFor(i, mode, narrow);
    return kind ? (DECOR_META[kind].w + 26) * zoom : 0;
  };
  // The case is a run of bays, each as wide as a real bookcase section; zooming in means fewer, wider-looking bays.
  const BAY = 400;
  const divPx = 14 * zoom;
  const nBays = Math.max(1, Math.round((width + divPx) / (BAY * zoom + divPx)));
  const bayPx = (width - (nBays - 1) * divPx) / nBays;
  const rows = packBays(designs, zoom, bayPx, nBays, reserve, MIN_ROWS);
  const light = LIGHT[settings.light] || LIGHT.low;
  const lightVars = { '--dim-edge': light['--dim-edge'], '--dim-mid': light['--dim-mid'], '--glow': light['--glow'] };

  return (
    <section className="shelf-section">
      <div className="section-head">
        <div>
          <h1>My Shelf</h1>
          <p>
            {allSorted.length === 0
              ? 'Books you’re reading and have finished live here.'
              : `${allSorted.length} book${allSorted.length === 1 ? '' : 's'} · ${counts.reading} reading · ${counts.read} finished`}
          </p>
        </div>
        <div className="shelf-tools">
          <div className="seg" role="group" aria-label="Show">
            {[['all', 'All'], ['reading', 'Reading'], ['read', 'Finished']].map(([k, label]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="zoom" role="group" aria-label="Zoom the shelf">
            <button onClick={() => setZoom((z) => clamp(z - 0.2, MIN_ZOOM, MAX_ZOOM))} aria-label="Zoom out">−</button>
            <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom level" />
            <button onClick={() => setZoom((z) => clamp(z + 0.2, MIN_ZOOM, MAX_ZOOM))} aria-label="Zoom in">+</button>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <button className={`chip-toggle lamp-toggle ${lamp ? 'on' : ''}`} onClick={() => setLamp(!lamp)} aria-pressed={lamp} title="Let the lamp follow your cursor">Lamp</button>
          {onRoom && <button className="chip-toggle" onClick={onRoom}>3D room</button>}
          <button className="chip-toggle customize" onClick={onCustomize}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15.5" cy="8" r="1" /></svg>
            Customize
          </button>
        </div>
      </div>

      <div className={`shelf-room library ${lamp ? 'lamp' : ''}`} ref={roomRef} style={{ '--z': zoom, ...woodVars(settings.wood), ...lightVars }} onPointerMove={onPointerMove}>
        <div className="wall" ref={wallRef} style={wallpaperStyle(settings.wallpaper)} />
        <Ceiling />
        <Gallery nBays={nBays} bayPx={bayPx} divPx={divPx} />
        <div className="unit" ref={unitRef} style={{ '--crest-h': '0px' }}>
          <i className="interior" />
          <Cornice crest={false} />
          <Pilaster side="l" />
          <Pilaster side="r" />
          {rows.map((row, i) => {
            const kind = decorFor(i, mode, narrow);
            return (
              <div className="row-wrap" key={i}>
                <div className="row" style={{ height: ROW_H * zoom }}>
                  {row.map((bay, b) => (
                    <Fragment key={b}>
                      {b > 0 && <i className="divider" style={{ width: divPx }} />}
                      <div className="bay" style={{ width: bayPx }}>
                  {bay.books.map((d) => (
                    <button
                      key={d.book.id}
                      data-spine-id={d.book.id}
                      className={`spine ${d.book.status === 'reading' ? 'is-reading' : ''} ${hiddenId === d.book.id ? 'gone' : ''} ${dragId === d.book.id ? 'lifting' : ''}`}
                      style={{ width: d.width * zoom, height: d.height * zoom, marginRight: 2 * zoom }}
                      onPointerDown={(e) => onSpineDown(e, d.book)}
                      onClick={(e) => !justDragged.current && onOpen(d.book, e.currentTarget.getBoundingClientRect(), 'spine')}
                      onKeyDown={(e) => onSpineKey(e, d.book)}
                      onContextMenu={(e) => e.preventDefault()}
                      aria-label={`${d.book.title}${d.book.authors[0] ? `, by ${d.book.authors[0]}` : ''}${d.book.status === 'reading' ? ' (reading now)' : ''}. Hold Alt and press an arrow key to move it.`}
                    >
                      <i className="cap" aria-hidden="true" />
                      <span className="spine-scale" style={{ transform: `scale(${zoom})` }}><SpineFace book={d.book} design={d} /></span>
                      {d.book.status === 'reading' && d.book.pages > 0 && <i className="spine-prog" aria-hidden="true"><b style={{ height: `${percentOf(d.book)}%` }} /></i>}
                      {d.book.status === 'reading' && <i className="ribbon" style={{ width: 7 * zoom, height: 26 * zoom }} />}
                      <span className="tip">{d.book.title}{d.book.status === 'reading' && d.book.pages > 0 ? ` · ${percentOf(d.book)}%` : ''}</span>
                    </button>
                  ))}
                  {stocked && <FillerRun seed={i * 13 + b + 1} space={bay.cap - bay.used} scale={zoom} />}
                      </div>
                    </Fragment>
                  ))}
                  {kind && (
                    <div className={`decor ${DECOR_META[kind].hang ? 'hang' : 'stand'} ${DECOR_META[kind].glow ? 'glow' : ''}`} style={{ right: 22 * zoom, width: DECOR_META[kind].w * zoom, height: DECOR_META[kind].h * zoom }}>
                      <Decor kind={kind} />
                    </div>
                  )}
                </div>
                <div className="plank-top" />
                <div className="plank" style={{ height: 15 + 3 * zoom }} />
                <Apron />
              </div>
            );
          })}
          <Base />
          {mode === 'full' && <Ladder />}
        </div>
        <Floor />
        <Chandelier />
        <Rays />
        <div className="dim" ref={dimRef} />
        {shown.length === 0 && (
          <div className="shelf-empty">
            <h3>{allSorted.length === 0 ? 'Your shelf is waiting' : `Nothing in “${filter === 'read' ? 'Finished' : 'Reading'}” yet`}</h3>
            <p>{allSorted.length === 0 ? 'Add a book you’re reading, or one you’ve already finished.' : 'Try another filter.'}</p>
            {allSorted.length === 0 && <button className="btn btn-primary" onClick={onFind}>Find a book</button>}
          </div>
        )}
      </div>
      {shown.length > 0 && <p className="shelf-hint"><span className="hint-pointer">Drag a book to rearrange your shelf. </span><span className="hint-touch">Press and hold a book, then drag it. </span>Zoom in to read the spines; tap a book to pull it out.</p>}

      {dragId && drag.current && (
        <div className="ghost" ref={ghostRef} style={{ width: drag.current.w, height: drag.current.h }} aria-hidden="true">
          <span className="spine-scale" style={{ transform: `scale(${zoom})` }}>
            <SpineFace book={drag.current.book} design={spineDesign(drag.current.book)} />
          </span>
        </div>
      )}
    </section>
  );
}
