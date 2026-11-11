import { useEffect, useRef, useState } from 'react';
import { Cover } from './Book';
import { lookupIsbn } from '../lib/library';
import { normIsbn } from '../lib/isbn';

const OPTIONS = [['reading', 'Reading now'], ['read', 'Finished'], ['want', 'To read']];

/**
 * Point the camera at the barcode on the back of a book. The ISBN is read, looked up, and shown for you to confirm
 * before anything is added. Keeps scanning so a whole shelf can be added in one go.
 */
export default function ScanSheet({ library, onAdd, onClose, onSearch }) {
  const videoRef = useRef(null);
  const control = useRef(null);
  const last = useRef({ code: '', at: 0 });
  const busy = useRef(false);
  const [phase, setPhase] = useState('starting'); // starting | scanning | looking | confirm | missing | denied
  const [found, setFound] = useState(null);
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState('');
  const [added, setAdded] = useState([]);
  const [adding, setAdding] = useState('');
  const have = new Map(library.map((b) => [b.workKey, b]));

  const lookup = async (code) => {
    const isbn = normIsbn(code);
    if (!isbn || busy.current) return;
    const now = Date.now();
    if (last.current.code === isbn && now - last.current.at < 4000) return;
    last.current = { code: isbn, at: now };
    busy.current = true;
    setPhase('looking');
    navigator.vibrate?.(15);
    try {
      const r = await lookupIsbn(isbn);
      setFound(r);
      setPhase('confirm');
    } catch (e) {
      setMessage(e.status === 404 ? 'That barcode isn’t in the catalog yet.' : e.message);
      setPhase('missing');
    }
  };
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  const resume = () => { busy.current = false; setFound(null); setMessage(''); setPhase('scanning'); };

  useEffect(() => {
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setPhase('denied'); setMessage('This browser can’t use the camera here. Type the ISBN or choose a photo instead.'); return; }
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.EAN_8]], [DecodeHintType.TRY_HARDER, true]]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        control.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          videoRef.current,
          (result) => { if (result && !stopped) lookupRef.current(result.getText()); }
        );
        if (!stopped) setPhase('scanning');
      } catch (e) {
        if (!stopped) { setPhase('denied'); setMessage(e?.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in your browser settings, or type the ISBN below.' : 'The camera could not be started. Type the ISBN or choose a photo instead.'); }
      }
    })();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { stopped = true; control.current?.stop(); window.removeEventListener('keydown', onKey); };
  }, []);

  const fromPhoto = async (file) => {
    if (!file) return;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const url = URL.createObjectURL(file);
      const res = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      busy.current = false;
      lookup(res.getText());
    } catch {
      setMessage('No barcode could be read in that photo. Try again closer, in better light.');
      setPhase((p) => (p === 'scanning' ? p : 'missing'));
    }
  };

  const add = async (status) => {
    setAdding(status);
    const ok = await onAdd(found, status);
    setAdding('');
    if (ok) { setAdded((a) => [found, ...a]); resume(); }
  };

  const existing = found && have.get(found.workKey);

  return (
    <div className="sheet-wrap scan" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet scan-sheet">
        <header>
          <h2>Scan a book</h2>
          <button className="viewer-close static" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className={`scan-view ${phase}`}>
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="scan-reticle" aria-hidden="true"><i /><span /></div>
          {phase === 'starting' && <p className="scan-msg">Starting the camera…</p>}
          {phase === 'scanning' && <p className="scan-msg">Hold the barcode on the back of the book inside the frame</p>}
          {phase === 'looking' && <p className="scan-msg">Looking it up…</p>}
        </div>

        {phase === 'confirm' && found && (
          <div className="scan-card" role="group" aria-label="Is this the book?">
            <div className="r-cover"><Cover book={found} /></div>
            <div className="scan-info">
              <span className="scan-q">Is this your book?</span>
              <h3>{found.title}</h3>
              <p>{[found.authors.join(', '), found.year, found.pages && `${found.pages} pages`].filter(Boolean).join(' · ')}</p>
              {found.series && <p className="scan-series">{found.seriesNo != null ? `Book ${found.seriesNo} of ` : 'Part of '}<b>{found.series}</b></p>}
              {existing ? (
                <p className="in-nook">✓ Already in your nook</p>
              ) : (
                <div className="r-actions">
                  {OPTIONS.map(([s, label]) => <button key={s} className="btn btn-small" disabled={!!adding} onClick={() => add(s)}>{adding === s ? 'Adding…' : label}</button>)}
                </div>
              )}
              <button className="link-btn" onClick={resume}>{existing ? 'Scan the next one' : 'Not this book, scan again'}</button>
            </div>
          </div>
        )}

        {(phase === 'missing' || phase === 'denied') && (
          <div className="scan-problem" role="alert">
            <p>{message}</p>
            {phase === 'missing' && <div className="scan-problem-actions"><button className="btn btn-small" onClick={resume}>Scan again</button><button className="btn btn-small" onClick={onSearch}>Search by title</button></div>}
          </div>
        )}

        <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); busy.current = false; lookup(manual); setManual(''); }}>
          <input inputMode="numeric" placeholder="Or type the ISBN" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="ISBN" />
          <button className="btn btn-small" disabled={!normIsbn(manual)}>Look up</button>
          <label className="btn btn-small btn-ghost">Photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} /></label>
        </form>

        {added.length > 0 && (
          <div className="scan-added" aria-live="polite">
            <span>Added this time: {added.length}</span>
            <div>{added.slice(0, 8).map((b) => <i key={b.workKey} title={b.title}><Cover book={b} /></i>)}</div>
          </div>
        )}
      </aside>
    </div>
  );
}
