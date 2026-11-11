import { useEffect, useRef, useState } from 'react';
import { removeSpine, uploadSpine } from '../lib/library';

const FRAME_H = 460; // the frame on screen; the saved photo is twice this tall
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Take or choose a photo of a real spine, then frame it: turn, zoom, move, and set how thick the book is. */
export default function SpineEditor({ book, onClose, onSaved }) {
  const [img, setImg] = useState(null);
  const [url, setUrl] = useState('');
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [thick, setThick] = useState(84);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  const pick = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose a photo.');
    const u = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setUrl(u); setImg(el); setError('');
      // a spine is tall: if the photo was taken sideways, turn it upright
      setRot(el.naturalWidth > el.naturalHeight ? 90 : 0);
      setZoom(1); setPos({ x: 0, y: 0 });
    };
    el.onerror = () => setError('That file could not be read as a photo.');
    el.src = u;
  };

  // scale at which the (rotated) photo's height just fills the frame
  const base = () => {
    const turned = rot % 180 !== 0;
    return FRAME_H / (turned ? img.naturalWidth : img.naturalHeight);
  };

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, p: pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setPos({ x: drag.current.p.x + e.clientX - drag.current.x, y: drag.current.p.y + e.clientY - drag.current.y });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const scale = 2;
      const W = Math.round(thick * scale), H = FRAME_H * scale;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2 + pos.x * scale, H / 2 + pos.y * scale);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(base() * zoom * scale, base() * zoom * scale);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      let blob = null;
      for (const q of [0.86, 0.74, 0.62, 0.5]) {
        blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= 380 * 1024) break;
      }
      if (!blob || blob.size > 390 * 1024) throw new Error('That photo is too large. Try a closer, simpler one.');
      onSaved(await uploadSpine(book.id, blob, W, H));
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      onSaved(await removeSpine(book.id));
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="spine-editor" role="dialog" aria-modal="true" aria-label="Photo of the spine">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="se-card">
        <header>
          <h2>Your real spine</h2>
          <button className="viewer-close static" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p className="muted">Photograph the spine of your copy of <b>{book.title}</b>, then drag and zoom so only the spine fills the frame.</p>

        <div className="se-stage">
          <div className="se-frame" style={{ width: thick, height: FRAME_H }} onPointerDown={img ? onDown : undefined} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
            {img ? (
              <img src={url} alt="" draggable="false" style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg) scale(${base() * zoom})` }} />
            ) : (
              <button className="se-pick" onClick={() => input.current.click()}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                <span>Take or choose a photo</span>
              </button>
            )}
            <i className="se-shade" />
          </div>
        </div>
        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />

        {img && (
          <div className="se-controls">
            <label>Zoom<input type="range" min="0.5" max="4" step="0.02" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
            <label>Thickness<input type="range" min="40" max="150" step="1" value={thick} onChange={(e) => setThick(Number(e.target.value))} /></label>
            <div className="se-row">
              <button className="btn btn-ghost" onClick={() => setRot((r) => (r + 90) % 360)}>Turn</button>
              <button className="btn btn-ghost" onClick={() => input.current.click()}>Different photo</button>
            </div>
          </div>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="se-actions">
          <button className="btn btn-primary" disabled={!img || busy} onClick={save}>{busy ? 'Saving…' : 'Use this spine'}</button>
          {book.spineV && <button className="link-btn" disabled={busy} onClick={remove}>Go back to the cover-colour spine</button>}
        </div>
      </div>
    </div>
  );
}
