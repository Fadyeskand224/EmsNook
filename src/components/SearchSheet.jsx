import { useEffect, useRef, useState } from 'react';
import { Cover, FanRating } from './Book';
import { searchBooks } from '../lib/library';

const OPTIONS = [['want', 'Want to read'], ['reading', 'Reading'], ['read', 'Read']];
const LABEL = { want: 'On your to-read list', reading: 'On your shelf, reading', read: 'On your shelf, finished' };

export default function SearchSheet({ library, onAdd, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');
  const [adding, setAdding] = useState('');
  const inputRef = useRef(null);
  const have = new Map(library.map((b) => [b.workKey, b.status]));

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setState('idle');
      return undefined;
    }
    setState('loading');
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setResults(await searchBooks(term, ctl.signal));
        setState('idle');
      } catch (e) {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setState('error');
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const add = async (book, status) => {
    setAdding(`${book.workKey}:${status}`);
    try {
      await onAdd(book, status);
    } finally {
      setAdding('');
    }
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Find a book">
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet">
        <header>
          <h2>Find a book</h2>
          <button className="viewer-close static" onClick={onClose} aria-label="Close">×</button>
        </header>
        <input ref={inputRef} className="search-input" type="search" placeholder="Title, author or ISBN" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="results" aria-live="polite">
          {state === 'loading' && <p className="muted">Searching the stacks…</p>}
          {state === 'error' && <p className="form-error">{error}</p>}
          {state === 'idle' && results === null && <p className="muted">Start typing to search millions of books.</p>}
          {state === 'idle' && results?.length === 0 && <p className="muted">No books found. Try fewer words.</p>}
          <ul>
            {results?.map((b) => {
              const status = have.get(b.workKey);
              return (
                <li key={b.workKey}>
                  <div className="r-cover"><Cover book={b} /></div>
                  <div className="r-info">
                    <h3>{b.title}</h3>
                    <p>{[b.authors.join(', '), b.year].filter(Boolean).join(' · ')}</p>
                    <FanRating book={{ rating: b.rating, ratingCount: b.ratingCount, ratingSource: 'Open Library', checked: true }} compact />
                    {status ? (
                      <span className="in-nook">✓ {LABEL[status]}</span>
                    ) : (
                      <div className="r-actions">
                        {OPTIONS.map(([s, label]) => (
                          <button key={s} className="btn btn-small" disabled={!!adding} onClick={() => add(b, s)}>
                            {adding === `${b.workKey}:${s}` ? 'Adding…' : label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
