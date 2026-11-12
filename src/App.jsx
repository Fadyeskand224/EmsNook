import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { setUnauthorizedHandler } from './lib/api';
import { fetchCurrentUser, logOut, downloadMyData } from './lib/auth';
import { addBook, fetchLibrary, fetchSettings, refreshBook, removeBook, reorderLibrary, fetchSeries, savePlaces, saveSettings, updateBook } from './lib/library';
import { DEFAULT_SETTINGS } from '../shared/options.js';
import Login from './components/Login';
import Shelf from './components/Shelf';
import { webglAvailable } from './room/gl';
// three.js is only downloaded when the 3D room is opened
const Room3D = lazy(() => import('./room/Room3D'));
import Wishlist from './components/Wishlist';
import SearchSheet from './components/SearchSheet';
const ScanSheet = lazy(() => import('./components/ScanSheet'));
import BookViewer from './components/BookViewer';
import Customize from './components/Customize';
import { crossed, percentOf } from './lib/progress';
import { PLANT_CREDITS } from './lib/plantCredits';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [bootError, setBootError] = useState('');
  const [books, setBooks] = useState([]);
  const [tab, setTab] = useState('shelf');
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [viewer, setViewer] = useState(null); // { id, origin }
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [credits, setCredits] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const saveTimer = useRef(null);
  const [view, setView] = useState(() => (localStorage.getItem('emsnook-view') || (webglAvailable() ? 'room' : 'classic')));
  const chooseView = (v) => { setView(v); localStorage.setItem('emsnook-view', v); };

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? '' : t)), 3500);
  }, []);

  const boot = useCallback(() => {
    setBootError('');
    fetchCurrentUser().then(setUser).catch((e) => setBootError(e.message));
  }, []);
  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); setBooks([]); });
    boot();
  }, [boot]);

  useEffect(() => {
    if (!user) return;
    // The shelf appears at once from this device's copy of the library, then is confirmed by the server.
    const key = `emsnook-books-${user.id}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved) && saved.length) setBooks(saved);
    } catch { /* no copy yet */ }
    fetchLibrary().then((b) => { setBooks(b); if (b.length && !b.some((x) => x.status !== 'want')) setTab('want'); }).catch((e) => say(e.message));
  }, [user, say]);

  useEffect(() => {
    if (!user || !books.length) return;
    const t = setTimeout(() => { try { localStorage.setItem(`emsnook-books-${user.id}`, JSON.stringify(books)); } catch { /* storage full */ } }, 400);
    return () => clearTimeout(t);
  }, [user, books]);

  // Look-and-feel choices: shown instantly from this device's copy, then confirmed from the account.
  useEffect(() => {
    if (!user) return;
    try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(`emsnook-look-${user.id}`)) }); } catch { /* use defaults */ }
    fetchSettings().then((s) => { setSettings(s); localStorage.setItem(`emsnook-look-${user.id}`, JSON.stringify(s)); }).catch(() => {});
  }, [user]);

  const changeLook = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    localStorage.setItem(`emsnook-look-${user.id}`, JSON.stringify(next));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSettings(next).catch((e) => say(e.message)), 500);
  };

  const reorder = async (ids) => {
    const pos = new Map(ids.map((id, i) => [id, i]));
    setBooks((list) => list.map((b) => (pos.has(b.id) ? { ...b, shelfPos: pos.get(b.id) } : b)));
    try {
      await reorderLibrary(ids);
    } catch (e) {
      say(e.message);
      fetchLibrary().then(setBooks).catch(() => {});
    }
  };

  // 3D room: where a book stands. Optimistic, then saved.
  const placeBook = async (id, place) => {
    setBooks((list) => list.map((b) => (b.id === id ? { ...b, place } : b)));
    try { await updateBook(id, { place }); } catch (e) { say(e.message); fetchLibrary().then(setBooks).catch(() => {}); }
  };
  const placeMany = (places) => {
    const map = new Map(places.map((p) => [p.id, { run: p.run, x: p.x }]));
    setBooks((list) => list.map((b) => (map.has(b.id) ? { ...b, place: map.get(b.id) } : b)));
    savePlaces(places).catch(() => {});
  };

  const ensureSeries = async () => { const list = await fetchSeries(); setBooks(list); };

  const put = (b) => setBooks((list) => list.map((x) => (x.id === b.id ? b : x)));

  const add = async (book, status) => {
    try {
      const saved = await addBook(book, status);
      setBooks((list) => [saved, ...list]);
      say(status === 'want' ? `“${saved.title}” is on your to-read list.` : `“${saved.title}” is on your shelf.`);
      return true;
    } catch (e) {
      say(e.message);
      return false;
    }
  };
  const move = async (book, status) => {
    try {
      put(await updateBook(book.id, { status }));
      say(status === 'reading' ? 'Enjoy the read!' : status === 'read' ? 'Added to your finished shelf.' : 'Moved back to your list.');
    } catch (e) {
      say(e.message);
    }
  };

  const openViewer = (book, rect, kind) => {
    setViewer({ id: book.id, origin: { rect, kind } });
    // Books saved while the catalog was down get their blurb and rating filled in now.
    if (!book.checked) refreshBook(book.id).then(put).catch(() => {});
  };
  const current = viewer && books.find((b) => b.id === viewer.id);

  const leave = async () => {
    await logOut();
    if (user) localStorage.removeItem(`emsnook-books-${user.id}`); // nothing of the account stays on a shared device
    setUser(null);
    setBooks([]);
    setMenu(false);
  };

  if (bootError) {
    return <div className="boot"><p>{bootError}</p><button className="btn btn-primary" onClick={boot}>Try again</button></div>;
  }
  if (user === undefined) return <div className="boot"><div className="spinner" aria-label="Loading" /></div>;
  if (!user) return <Login onAuthed={setUser} />;

  const wantCount = books.filter((b) => b.status === 'want').length;
  const shelfCount = books.length - wantCount;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" onClick={(e) => e.preventDefault()}><img src="/icon.svg" alt="" width="30" height="30" />EmsNook</a>
        <nav className="tabs" aria-label="Sections">
          <button className={tab === 'shelf' ? 'on' : ''} onClick={() => setTab('shelf')}>My Shelf <b>{shelfCount}</b></button>
          <button className={tab === 'want' ? 'on' : ''} onClick={() => setTab('want')}>To Read <b>{wantCount}</b></button>
        </nav>
        <div className="top-actions">
          <button className="btn btn-ghost scan-btn" onClick={() => setScanning(true)} aria-label="Scan a barcode"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 9v6M11 9v6M14 9v6M17 9v6" /></svg><span className="hide-sm">Scan</span></button>
          <button className="btn btn-primary" onClick={() => setSearching(true)}>+ <span className="hide-sm">Add a book</span></button>
          <div className="user">
            <button className="avatar" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account">{user.name.trim()[0]?.toUpperCase()}</button>
            {menu && (
              <div className="menu" role="menu">
                <p>{user.name}<small>{user.email}</small></p>
                <button role="menuitem" onClick={() => downloadMyData().catch((e) => say(e.message))}>Download my data</button>
                <button role="menuitem" onClick={() => { setCredits(true); setMenu(false); }}>Photo credits</button>
                <button role="menuitem" onClick={leave}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {tab === 'shelf'
          ? (view === 'room' && webglAvailable()
            ? <Suspense fallback={<div className="room3d room-loading"><div className="spinner" aria-label="Opening the library" /></div>}><Room3D books={books} hiddenId={viewer?.id} settings={settings} onOpen={openViewer} onFind={() => setSearching(true)} onCustomize={() => setCustomizing(true)} onPlace={placeBook} onPlaceMany={placeMany} onEnsureSeries={ensureSeries} onClassic={() => chooseView('classic')} /></Suspense>
            : <Shelf books={books} hiddenId={viewer?.id} settings={settings} onOpen={openViewer} onFind={() => setSearching(true)} onCustomize={() => { setCustomizing(true); document.querySelector('.shelf-room')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onReorder={reorder} onRoom={webglAvailable() ? () => chooseView('room') : null} />)
          : <Wishlist books={books} onOpen={openViewer} onStatus={move} onFind={() => setSearching(true)} />}
      </main>

      {customizing && tab === 'shelf' && <Customize settings={settings} room={view === 'room' && webglAvailable()} onChange={changeLook} onClose={() => setCustomizing(false)} />}
      <nav className="tabbar" aria-label="Sections">
        <button className={tab === 'shelf' ? 'on' : ''} onClick={() => setTab('shelf')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="4" height="12" rx="1" /><rect x="9.5" y="3" width="4.5" height="14" rx="1" /><path d="m16 6.5 3.4-.9 2.6 10.4-3.4.9z" /><path d="M2.5 20.5h19" /></svg>
          Shelf <b>{shelfCount}</b>
        </button>
        <button className="tab-add" onClick={() => setSearching(true)} aria-label="Add a book"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
        <button className={tab === 'want' ? 'on' : ''} onClick={() => setTab('want')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" /></svg>
          To Read <b>{wantCount}</b>
        </button>
      </nav>

      {scanning && <Suspense fallback={null}><ScanSheet library={books} onAdd={add} onClose={() => setScanning(false)} onSearch={() => { setScanning(false); setSearching(true); }} /></Suspense>}
      {searching && <SearchSheet library={books} onAdd={add} onClose={() => setSearching(false)} />}
      {current && (
        <BookViewer
          key={current.id}
          book={current}
          origin={viewer.origin}
          onClose={() => setViewer(null)}
          onSpine={put}
          onSize={(patch) => updateBook(current.id, patch).then(put).catch((e) => say(e.message))}
          onProgress={async (patch) => {
            const before = percentOf(current);
            try {
              const saved = await updateBook(current.id, patch);
              put(saved);
              const hit = crossed(before, percentOf(saved));
              if (hit === 100) say('You reached the last page!');
              else if (hit) say(`${hit}% of “${saved.title}” read. Keep going!`);
            } catch (e) { say(e.message); }
          }}
          onStatus={(s) => move(current, s)}
          onRate={(n) => updateBook(current.id, { myRating: n }).then(put).catch((e) => say(e.message))}
          onRemove={async () => {
            try { await removeBook(current.id); setBooks((l) => l.filter((b) => b.id !== current.id)); setViewer(null); say('Removed from your nook.'); } catch (e) { say(e.message); }
          }}
        />
      )}
      {credits && (
        <div className="spine-editor" role="dialog" aria-modal="true" aria-label="Photo credits">
          <div className="sheet-backdrop" onClick={() => setCredits(false)} />
          <div className="se-card">
            <header><h2>Photo credits</h2><button className="viewer-close static" onClick={() => setCredits(false)} aria-label="Close">×</button></header>
            <p className="muted">The plants on your shelf are photographs from Unsplash, used under the Unsplash License and cut out from their backgrounds. Book covers come from Open Library.</p>
            <ul className="credits">{PLANT_CREDITS.map(([what, who]) => <li key={what}><span>{what}</span><b>{who}</b></li>)}</ul>
            <button className="btn btn-primary" onClick={() => setCredits(false)}>Done</button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
