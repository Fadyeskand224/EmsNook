import { useState } from 'react';
import { spineDesign, spineFontSize } from '../lib/spine';

/** A cover: the real image when we have one, or a printed-looking stand-in. */
export function Cover({ book, className = '', eager = false }) {
  const [failed, setFailed] = useState(false);
  const d = spineDesign(book);
  if (book.coverUrl && !failed) {
    return (
      <img className={`cover-img ${className}`} src={book.coverUrl} alt={`Cover of ${book.title}`} loading={eager ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    );
  }
  return (
    <div className={`cover-fallback ${className}`} style={{ '--bg': d.bg, '--fg': d.fg, '--accent': d.accent }} role="img" aria-label={`Cover of ${book.title}`}>
      <span className="cf-rule" />
      <strong>{book.title}</strong>
      <span className="cf-rule" />
      <em>{book.authors.join(', ')}</em>
    </div>
  );
}

/** Partial stars: 4.3 fills four and a bit. */
export function Stars({ value, size = 16 }) {
  const pct = Math.max(0, Math.min(5, value || 0)) * 20;
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${(value || 0).toFixed(1)} out of 5 stars`}>
      <span className="stars-base">★★★★★</span>
      <span className="stars-fill" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

export function FanRating({ book, compact = false }) {
  if (!book.rating) {
    return <span className="fan none">{book.checked ? 'No fan ratings found yet' : 'Looking for fan ratings…'}</span>;
  }
  return (
    <span className={`fan ${compact ? 'compact' : ''}`}>
      <Stars value={book.rating} size={compact ? 13 : 18} />
      <b>{book.rating.toFixed(1)}</b>
      {!compact && (
        <small>
          {book.ratingCount.toLocaleString()} fan rating{book.ratingCount === 1 ? '' : 's'} · {book.ratingSource}
        </small>
      )}
    </span>
  );
}

/** A decorative barcode drawn from the ISBN digits, like the one on a real back cover. */
export function Barcode({ code }) {
  const digits = (code || '9780000000002').replace(/\D/g, '').padEnd(13, '0');
  const bars = [];
  let x = 4;
  for (const ch of digits) {
    const n = Number(ch);
    for (const w of [1 + (n % 3), 1 + ((n >> 1) % 2)]) {
      bars.push(<rect key={bars.length} x={x} y="0" width={w} height="38" />);
      x += w + 1.4;
    }
    x += 1.2;
  }
  return (
    <div className="barcode" aria-label={code ? `ISBN ${code}` : undefined}>
      <svg viewBox={`0 0 ${x + 4} 38`} preserveAspectRatio="none" aria-hidden="true">
        <rect width={x + 4} height="38" fill="#f7efe0" />
        <g fill="#1d1510">{bars}</g>
      </svg>
      {code && <span>{code}</span>}
    </div>
  );
}

/** The spine at its design size. Wrap it to scale it (shelf zoom, or the 3D book). */
export function SpineFace({ book, design = spineDesign(book) }) {
  if (design.photo) {
    return (
      <div className="spine-face photo" style={{ width: design.width, height: design.height }}>
        <img src={design.photo} alt="" draggable="false" />
      </div>
    );
  }
  const { size, wrap } = spineFontSize(book.title, design);
  const author = (book.authors[0] || '').trim().split(/\s+/).pop().toUpperCase(); // spines carry the surname
  return (
    <div
      className={`spine-face s-${design.style} f-${design.font}`}
      style={{ width: design.width, height: design.height, '--bg': design.bg, '--fg': design.fg, '--accent': design.accent }}
    >
      <i className="sp-line l1" />
      <i className="sp-line l2" />
      <span className={`sp-title ${wrap ? 'wrap' : ''}`} style={{ fontSize: size, maxHeight: design.height - 90 }}>{book.title}</span>
      <span className="sp-author">{author}</span>
      <i className="sp-mark" />
    </div>
  );
}
