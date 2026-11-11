import { useMemo, useState } from 'react';
import { Cover, FanRating } from './Book';

const SORTS = {
  recent: ['Recently added', (a, b) => b.addedAt - a.addedAt],
  rating: ['Highest rated', (a, b) => (b.rating || 0) - (a.rating || 0)],
  title: ['Title A–Z', (a, b) => a.title.localeCompare(b.title)],
};

export default function Wishlist({ books, onOpen, onStatus, onFind }) {
  const [sort, setSort] = useState('recent');
  const list = useMemo(() => books.filter((b) => b.status === 'want').sort(SORTS[sort][1]), [books, sort]);

  return (
    <section className="wish">
      <div className="section-head">
        <div>
          <h1>To Read</h1>
          <p>{list.length ? `${list.length} book${list.length === 1 ? '' : 's'} waiting for you` : 'Books you’d like to read someday.'}</p>
        </div>
        <div className="shelf-tools">
          <label className="select">
            <span className="sr">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={onFind}>+ Add a book</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-books" aria-hidden="true"><i /><i /><i /></div>
          <h3>Your to-read list is empty</h3>
          <p>Search for a book and save it here. You can look at the cover, flip it over to read the back, and see what other readers think.</p>
          <button className="btn btn-primary" onClick={onFind}>Find a book</button>
        </div>
      ) : (
        <ul className="cards">
          {list.map((b) => (
            <li key={b.id} className="card">
              <button className="flip-card" onClick={(e) => onOpen(b, e.currentTarget.getBoundingClientRect(), 'card')} aria-label={`Open ${b.title}`}>
                <span className="flip-inner">
                  <i className="page-edge" aria-hidden="true" />
                  <span className="flip-front"><Cover book={b} /></span>
                  <span className="flip-back">
                    <small>{b.subjects?.[0] || 'On the back'}</small>
                    <span className="snippet">{b.description ? b.description.slice(0, 230).replace(/\s+\S*$/, '') + '…' : b.checked ? 'No blurb found yet.' : 'Reading the back…'}</span>
                    <em>Open to read more</em>
                  </span>
                </span>
              </button>
              <div className="card-body">
                <h3 title={b.title}>{b.title}</h3>
                <p className="by">{b.authors[0] || 'Unknown author'}</p>
                <FanRating book={b} compact />
                <button className="btn btn-small" onClick={() => onStatus(b, 'reading')}>Start reading</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
