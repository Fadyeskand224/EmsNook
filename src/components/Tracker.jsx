import { useEffect, useState } from 'react';
import { fetchLog } from '../lib/library';
import { percentOf, summarize } from '../lib/progress';

const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const R = 44;
const C = 2 * Math.PI * R;

/** The reading tracker for a book that is being read: page, percentage, pace, finish estimate and streak. */
export default function Tracker({ book, onProgress, onFinish }) {
  const [log, setLog] = useState([]);
  const [page, setPage] = useState(String(book.currentPage || 0));
  const [total, setTotal] = useState('');
  const [busy, setBusy] = useState(false);
  const pct = percentOf(book);

  const load = () => fetchLog(book.id).then(setLog).catch(() => {});
  useEffect(() => { load(); }, [book.id]);
  useEffect(() => setPage(String(book.currentPage || 0)), [book.currentPage]);

  const save = async (patch) => {
    if (busy) return;
    setBusy(true);
    try { await onProgress(patch); await load(); } finally { setBusy(false); }
  };
  const goto = (n) => {
    const max = book.pages || 20000;
    const v = Math.max(0, Math.min(max, Math.round(Number(n))));
    if (!Number.isFinite(v)) return;
    setPage(String(v));
    if (v !== book.currentPage) save({ currentPage: v });
  };

  const stats = summarize(book, log);
  const done = pct === 100;

  if (!book.pages) {
    return (
      <section className="tracker" aria-label="Reading tracker">
        <h3>Track your reading</h3>
        <p className="tr-note">We don’t know how long your copy is. Enter its page count to start tracking.</p>
        <form className="tr-form" onSubmit={(e) => { e.preventDefault(); const n = Number(total); if (n >= 1) save({ pages: Math.round(n) }); }}>
          <input type="number" inputMode="numeric" min="1" max="20000" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Total pages" aria-label="Total pages" />
          <button className="btn btn-primary btn-small" disabled={busy || !(Number(total) >= 1)}>Start tracking</button>
        </form>
      </section>
    );
  }

  return (
    <section className="tracker" aria-label="Reading tracker">
      <div className="tr-top">
        <div className="tr-ring" role="img" aria-label={`${pct} percent read`}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} className="trk" />
            <circle cx="50" cy="50" r={R} className="val" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
          </svg>
          <b>{pct}<small>%</small></b>
        </div>
        <div className="tr-where">
          <span className="tr-label">You’re on</span>
          <span className="tr-page">page <b>{book.currentPage}</b> <i>of {book.pages}</i></span>
          <span className="tr-left">{done ? 'You’ve reached the last page.' : `${stats.left} pages to go`}</span>
        </div>
      </div>

      <input type="range" className="tr-slider" min="0" max={book.pages} value={Number(page) || 0} style={{ '--v': `${pct}%` }}
        onChange={(e) => setPage(e.target.value)} onPointerUp={(e) => goto(e.target.value)} onKeyUp={(e) => goto(e.target.value)} aria-label="Current page" />

      <form className="tr-form" onSubmit={(e) => { e.preventDefault(); goto(page); }}>
        <label className="tr-in"><span>Page</span>
          <input type="number" inputMode="numeric" min="0" max={book.pages} value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page number" />
        </label>
        <button className="btn btn-primary btn-small" disabled={busy}>Update</button>
        <span className="tr-quick">
          {[10, 25, 50].map((n) => <button type="button" key={n} disabled={busy || done} onClick={() => goto(book.currentPage + n)}>+{n}</button>)}
        </span>
      </form>

      {done && <button className="btn btn-primary tr-finish" onClick={onFinish}>Finish this book</button>}

      <dl className="tr-stats">
        <div><dt>Today</dt><dd>{stats.today} <small>pages</small></dd></div>
        <div><dt>Pace</dt><dd>{stats.pace ? stats.pace : '–'} <small>pages/day</small></dd></div>
        <div><dt>Streak</dt><dd>{stats.streak} <small>{stats.streak === 1 ? 'day' : 'days'}</small></dd></div>
        <div><dt>Finish by</dt><dd>{done ? 'Done' : stats.finishAt ? fmt(stats.finishAt) : '–'}</dd></div>
      </dl>

      <div className="tr-days" aria-label="Pages read in the last 14 days">
        {stats.days.map((d, i) => (
          <span key={i} className={d.pages ? 'on' : ''} title={`${fmt(d.t)}: ${d.pages} pages`}><i style={{ height: `${d.pages ? 14 + (d.pages / stats.best) * 86 : 8}%` }} /></span>
        ))}
      </div>
      <p className="tr-note">{stats.pace ? 'Your pace comes from the last two weeks of updates.' : 'Update your page as you read and we’ll work out your pace and when you’ll finish.'}</p>
    </section>
  );
}
