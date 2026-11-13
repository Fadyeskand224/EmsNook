import { useState } from 'react';
import { Cover } from './Book';
import { percentOf } from '../lib/progress';

const TABS = [['reading', 'Reading'], ['want', 'To read'], ['read', 'Read'], ['all', 'All']];

/** Every book in the nook, by what you're doing with it. Lives in the pull-out menu. */
export default function MyBooks({ books, onOpen }) {
  const count = (k) => (k === 'all' ? books.length : books.filter((b) => b.status === k).length);
  const [tab, setTab] = useState(() => (count('reading') ? 'reading' : 'all'));
  const list = books
    .filter((b) => tab === 'all' || b.status === tab)
    .sort((a, b) => (tab === 'all' ? ['reading', 'want', 'read'].indexOf(a.status) - ['reading', 'want', 'read'].indexOf(b.status) : 0) || (b.finishedAt || b.startedAt || b.addedAt || 0) - (a.finishedAt || a.startedAt || a.addedAt || 0));
  return (
    <section className="mybooks" aria-label="My books">
      <h4>My books</h4>
      <div className="mb-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}<b>{count(k)}</b></button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mb-empty">{tab === 'reading' ? 'Nothing in progress right now.' : tab === 'want' ? 'Your to-read list is empty.' : tab === 'read' ? 'No finished books yet.' : 'No books yet. Tap + to add one.'}</p>
      ) : (
        <ul className="mb-list">
          {list.map((b) => (
            <li key={b.id}>
              <button onClick={(e) => onOpen(b, e.currentTarget.querySelector('.mb-cover').getBoundingClientRect())}>
                <span className="mb-cover"><Cover book={b} /></span>
                <span className="mb-text">
                  <strong>{b.title}</strong>
                  <small>{b.authors?.[0] || 'Unknown author'}</small>
                </span>
                {tab === 'all' && <i className={`mb-dot st-${b.status}`}>{b.status === 'reading' ? 'Reading' : b.status === 'want' ? 'To read' : 'Read'}</i>}
                {b.status === 'reading' && b.pages ? <em className="mb-pct">{percentOf(b)}%</em> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
