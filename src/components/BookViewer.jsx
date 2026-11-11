import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Barcode, Cover, FanRating, SpineFace } from './Book';
import { spineDesign } from '../lib/spine';
import SpineEditor from './SpineEditor';
import Tracker from './Tracker';

const PERSPECTIVE = 1500;
const EASE = 'cubic-bezier(.22,.9,.24,1)';
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function bookWidth() {
  const vw = window.innerWidth;
  return Math.round(vw < 760 ? Math.min(260, vw * 0.6) : Math.max(220, Math.min(310, vw * 0.27)));
}

export default function BookViewer({ book, origin, onClose, onStatus, onRate, onRemove, onSpine, onProgress }) {
  const design = spineDesign(book);
  const [W, setW] = useState(bookWidth);
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingSpine, setEditingSpine] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const boxRef = useRef(null);
  const closing = useRef(false);
  const H = Math.round(W * 1.5);
  const T = Math.round((H * design.width) / design.height); // thickness matches the spine on the shelf

  useEffect(() => {
    const onResize = () => setW(bookWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The book slides out of its place on the shelf (or card) and turns to show its front cover.
  const transformFrom = () => {
    const stage = stageRef.current.getBoundingClientRect();
    const r = origin.rect;
    const dx = r.left + r.width / 2 - (stage.left + stage.width / 2);
    const dy = r.top + r.height / 2 - (stage.top + stage.height / 2);
    if (origin.kind === 'spine') {
      const s = (r.height / H) * ((PERSPECTIVE - W / 2) / PERSPECTIVE); // spine face sits W/2 closer to the viewer
      return `translate(${dx}px, ${dy}px) scale(${s}) rotateY(90deg)`;
    }
    return `translate(${dx}px, ${dy}px) scale(${r.width / W}) rotateY(-24deg)`;
  };
  const REST = 'translate(0px, 0px) scale(1) rotateY(0deg)';

  useLayoutEffect(() => {
    if (!origin || reducedMotion() || !boxRef.current.animate) return setReady(true);
    const anim = boxRef.current.animate([{ transform: transformFrom() }, { transform: REST }], { duration: 820, easing: EASE, fill: 'backwards' });
    anim.onfinish = () => setReady(true);
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setFlipped(false);
    setTilt({ x: 0, y: 0 });
    setReady(false);
    if (!origin || reducedMotion() || !boxRef.current?.animate) return onClose();
    const anim = boxRef.current.animate([{ transform: REST }, { transform: transformFrom() }], { duration: 560, easing: 'cubic-bezier(.5,0,.75,.2)', fill: 'forwards', delay: 120 });
    anim.onfinish = onClose;
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.spine-editor')) close();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setFlipped((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = (e) => {
    if (!ready || e.pointerType === 'touch') return;
    const r = stageRef.current.getBoundingClientRect();
    setTilt({ y: ((e.clientX - r.left) / r.width - 0.5) * 26, x: -((e.clientY - r.top) / r.height - 0.5) * 14 });
  };

  const paragraphs = (book.description || '').split(/\n{2,}/).filter(Boolean);
  const k = H / design.height;
  const status = {
    want: { label: 'On your to-read list', next: 'reading', nextLabel: 'Start reading', alt: 'read', altLabel: 'I’ve already read it' },
    reading: { label: 'Reading now', next: 'read', nextLabel: 'I finished it!', alt: 'want', altLabel: 'Back to my list' },
    read: { label: 'Finished', next: 'reading', nextLabel: 'Read it again', alt: null },
  }[book.status];

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={book.title}>
      <div className={`viewer-backdrop ${closing.current ? 'out' : ''}`} onClick={close} />
      <div className="viewer-body" style={{ '--bw': `${W}px`, '--bh': `${H}px` }}>
        <button className="viewer-close" onClick={close} aria-label="Close" autoFocus>×</button>

        <div className="stage-col">
          <div className="stage" ref={stageRef} style={{ perspective: PERSPECTIVE, width: W, height: H }} onPointerMove={onPointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
            <div className="tilt" style={{ transform: `rotateX(${ready ? tilt.x : 0}deg) rotateY(${ready ? tilt.y : 0}deg)` }}>
              <div className="box" ref={boxRef} style={{ width: W, height: H }}>
                <div className="flipper" style={{ transform: flipped ? 'rotateY(-180deg)' : 'rotateY(0deg)' }}>
                  <div className="face front" style={{ transform: `translateZ(${T / 2}px)` }} onClick={() => setFlipped(true)}>
                    <Cover book={book} eager />
                    <i className="gloss" />
                    <i className="hinge" />
                  </div>
                  <div className="face back" style={{ transform: `rotateY(180deg) translateZ(${T / 2}px)` }} onClick={(e) => !e.target.closest('.blurb-wrap') && setFlipped(false)}>
                    <BackCover book={book} paragraphs={paragraphs} />
                    <i className="hinge r" />
                  </div>
                  <div className="face side spine-side" style={{ width: T, left: (W - T) / 2, transform: `rotateY(-90deg) translateZ(${W / 2}px)` }}>
                    <div style={{ transform: `scale(${k})`, transformOrigin: 'top left', width: design.width, height: design.height }}>
                      <SpineFace book={book} design={design} />
                    </div>
                  </div>
                  <div className="face side pages-side" style={{ width: T, left: (W - T) / 2, transform: `rotateY(90deg) translateZ(${W / 2}px)` }} />
                  <div className="face side top-side" style={{ height: T, top: (H - T) / 2, width: W, transform: `rotateX(90deg) translateZ(${H / 2}px)` }} />
                </div>
              </div>
            </div>
            <div className="floor-shadow" style={{ width: W * 0.9 }} />
          </div>
          <div className="seg flip-seg" role="group" aria-label="Which side of the book">
            <button className={!flipped ? 'on' : ''} onClick={() => setFlipped(false)}>Front cover</button>
            <button className={flipped ? 'on' : ''} onClick={() => setFlipped(true)}>Back cover</button>
          </div>
          <p className="hint">Tap the book to turn it over</p>
        </div>

        <div className="info">
          <span className={`pill st-${book.status}`}>{status.label}</span>
          <h2>{book.title}</h2>
          <p className="by">{book.authors.length ? `by ${book.authors.join(', ')}` : 'Unknown author'}</p>
          <p className="meta">{[book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(' · ')}</p>
          {book.series && <p className="meta series-line">{book.seriesNo != null ? `Book ${book.seriesNo} of ` : 'Part of '}<b>{book.series}</b></p>}
          <div className="rating-row"><FanRating book={book} /></div>

          {book.status === 'read' && (
            <div className="mine">
              <span>Your rating</span>
              <span className="mine-stars" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={book.myRating === n} className={n <= (book.myRating || 0) ? 'on' : ''} onClick={() => onRate(book.myRating === n ? null : n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
                ))}
              </span>
            </div>
          )}

          {book.status === 'reading' && <Tracker book={book} onProgress={onProgress} onFinish={() => onStatus('read')} />}

          <div className="actions">
            <button className="btn btn-primary" onClick={() => onStatus(status.next)}>{status.nextLabel}</button>
            {status.alt && <button className="btn btn-ghost" onClick={() => onStatus(status.alt)}>{status.altLabel}</button>}
          </div>

          {book.subjects?.length > 0 && (
            <div className="chips">{book.subjects.slice(0, 5).map((s) => <span key={s}>{s}</span>)}</div>
          )}
          <dl className="dates">
            <div><dt>Added</dt><dd>{fmtDate(book.addedAt)}</dd></div>
            {book.startedAt && <div><dt>Started</dt><dd>{fmtDate(book.startedAt)}</dd></div>}
            {book.finishedAt && <div><dt>Finished</dt><dd>{fmtDate(book.finishedAt)}</dd></div>}
          </dl>

          {book.status !== 'want' && (
            <button className="btn btn-ghost btn-small spine-btn" onClick={() => setEditingSpine(true)}>
              {book.spineV ? 'Change my spine photo' : 'Add a photo of my real spine'}
            </button>
          )}

          {confirmRemove ? (
            <div className="confirm">
              <span>Remove this book from your nook?</span>
              <button className="btn btn-danger" onClick={onRemove}>Yes, remove</button>
              <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Keep it</button>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setConfirmRemove(true)}>Remove from my nook</button>
          )}
        </div>
      </div>
      {editingSpine && <SpineEditor book={book} onClose={() => setEditingSpine(false)} onSaved={onSpine} />}
    </div>
  );
}

function BackCover({ book, paragraphs }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false); // true while there is more text below the fold

  const check = () => {
    const el = ref.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };
  useEffect(check, [book.description]);

  return (
    <div className="back-cover">
      <div className="bc-head">
        <span className="bc-kicker">{book.subjects?.[0] || 'A book'}</span>
        <h4>{book.title}</h4>
        <i className="bc-rule" />
      </div>
      <div className={`blurb-wrap ${more ? 'more' : ''}`}>
        <div className="blurb" ref={ref} tabIndex={0} onScroll={check}>
          {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : (
            <p className="no-blurb">{book.checked ? 'We couldn’t find a back-cover blurb for this one yet.' : 'Reading the back cover…'}</p>
          )}
        </div>
      </div>
      <div className="bc-foot">
        {book.rating ? <div className="bc-score"><b>{book.rating.toFixed(1)}</b><span>★ from {book.ratingCount.toLocaleString()} readers</span></div> : <span />}
        <Barcode code={book.isbn} />
      </div>
    </div>
  );
}
