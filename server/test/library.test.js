import './env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { combineRatings, detectSeries, normIsbn } from '../books.js';
import { DEFAULT_SETTINGS } from '../../shared/options.js';

// A fake catalog, so tests never touch the network.
const fakeFetch = async (url) => {
  const u = String(url);
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  if (u.includes('/search.json')) {
    return json({ docs: [
      { key: '/works/OL27482W', title: 'The Hobbit', author_name: ['J.R.R. Tolkien'], cover_i: 14627509, isbn: ['9780547928227'], number_of_pages_median: 300, first_publish_year: 1937 },
      { key: '/authors/bad', title: 'Not a work' },
    ] });
  }
  if (u.endsWith('/ratings.json')) return json({ summary: { average: 4.3, count: 500 } });
  if (u.includes('/works/OL27482W.json')) return json({ description: 'A hobbit goes on an adventure.\n\n----------\nSource: somewhere', subjects: ['Fantasy', 'Dragons'] });
  return json({}, 404);
};

let server, base, db;
before(async () => {
  db = await openDb({ url: ':memory:' });
  const app = createApp({ db, fetchImpl: fakeFetch, limits: { auth: 1000, signup: 1000 } });
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); });

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: base },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const signup = async (email) => (await call('/auth/signup', { method: 'POST', body: { name: 'Reader One', email, password: 'tea-and-dragons-42' } })).cookie;

test('library needs a login', async () => {
  assert.equal((await call('/library')).status, 401);
  assert.equal((await call('/books/search?q=hobbit')).status, 401);
});

test('search returns only real works, with covers', async () => {
  const cookie = await signup('search@example.com');
  const r = await call('/books/search?q=the hobbit', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.results.length, 1);
  assert.equal(r.json.results[0].workKey, 'OL27482W');
  assert.match(r.json.results[0].coverUrl, /^https:\/\/covers\.openlibrary\.org\//);
});

test('adding a book enriches it with a blurb and a fan rating, and moves between shelves', async () => {
  const cookie = await signup('add@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie })).json.results[0];
  const added = await call('/library', { method: 'POST', cookie, body: { book: search, status: 'want' } });
  assert.equal(added.status, 201);
  assert.equal(added.json.book.description, 'A hobbit goes on an adventure.');
  assert.equal(added.json.book.rating, 4.3);
  assert.equal(added.json.book.ratingSource, 'Open Library');
  assert.deepEqual(added.json.book.subjects, ['Fantasy', 'Dragons']);

  assert.equal((await call('/library', { method: 'POST', cookie, body: { book: search, status: 'want' } })).status, 409);

  const id = added.json.book.id;
  const reading = await call(`/library/${id}`, { method: 'PATCH', cookie, body: { status: 'reading' } });
  assert.equal(reading.json.book.status, 'reading');
  assert.ok(reading.json.book.startedAt);
  const done = await call(`/library/${id}`, { method: 'PATCH', cookie, body: { status: 'read', myRating: 5 } });
  assert.ok(done.json.book.finishedAt);
  assert.equal(done.json.book.myRating, 5);
  assert.equal((await call(`/library/${id}`, { method: 'PATCH', cookie, body: { myRating: 9 } })).status, 400);
  assert.equal((await call('/library', { cookie })).json.books.length, 1);
});

test("one reader can never see or change another's books", async () => {
  const a = await signup('a@example.com');
  const b = await signup('b@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie: a })).json.results[0];
  const { json } = await call('/library', { method: 'POST', cookie: a, body: { book: search, status: 'want' } });
  assert.equal((await call('/library', { cookie: b })).json.books.length, 0);
  assert.equal((await call(`/library/${json.book.id}`, { method: 'PATCH', cookie: b, body: { status: 'read' } })).status, 404);
  assert.equal((await call(`/library/${json.book.id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/library/${json.book.id}`, { method: 'DELETE', cookie: a })).status, 200);
});

test('rejects books with bad data or cover hosts', async () => {
  const cookie = await signup('bad@example.com');
  const ok = { workKey: 'OL1W', title: 'X', authors: ['Y'], coverUrl: null };
  assert.equal((await call('/library', { method: 'POST', cookie, body: { book: { ...ok, coverUrl: 'https://evil.example/x.jpg' }, status: 'want' } })).status, 400);
  assert.equal((await call('/library', { method: 'POST', cookie, body: { book: { ...ok, workKey: '../etc' }, status: 'want' } })).status, 400);
  assert.equal((await call('/library', { method: 'POST', cookie, body: { book: ok, status: 'nope' } })).status, 400);
});

test('state-changing requests from another origin are refused', async () => {
  const res = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('combined ratings are weighted by how many people rated', () => {
  const r = combineRatings([{ source: 'A', avg: 5, count: 1 }, { source: 'B', avg: 4, count: 3 }, null, { source: 'C', avg: 0, count: 10 }]);
  assert.equal(r.rating, 4.25);
  assert.equal(r.ratingCount, 4);
  assert.equal(r.ratingSource, 'A + B');
  assert.equal(combineRatings([]).rating, null);
});

test('shelf order is saved per reader and ignores books that are not yours', async () => {
  const a = await signup('order-a@example.com');
  const b = await signup('order-b@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie: a })).json.results[0];
  const mine = (await call('/library', { method: 'POST', cookie: a, body: { book: search, status: 'read' } })).json.book;
  const theirs = (await call('/library', { method: 'POST', cookie: b, body: { book: search, status: 'read' } })).json.book;
  assert.equal((await call('/library/order', { method: 'PUT', cookie: a, body: { ids: [theirs.id, mine.id] } })).status, 200);
  const list = (await call('/library', { cookie: a })).json.books;
  assert.equal(list[0].shelfPos, 1); // position follows the sent order
  assert.equal((await call('/library', { cookie: b })).json.books[0].shelfPos, null); // b's book was untouched
  assert.equal((await call('/library/order', { method: 'PUT', cookie: a, body: { ids: [mine.id, mine.id] } })).status, 400);
  assert.equal((await call('/library/order', { method: 'PUT', cookie: a, body: { ids: 'x' } })).status, 400);
});

test('look-and-feel settings are validated and remembered', async () => {
  const cookie = await signup('look@example.com');
  assert.equal((await call('/settings', { cookie })).json.settings.wood, 'mahogany');
  const saved = await call('/settings', { method: 'PUT', cookie, body: { settings: { wallpaper: 'brick', wood: 'oak', light: 'medium' } } });
  assert.equal(saved.status, 200);
  const got = (await call('/settings', { cookie })).json.settings;
  assert.deepEqual(got, { ...DEFAULT_SETTINGS, wallpaper: 'brick', wood: 'oak', light: 'medium' });
  assert.equal(got.fill, 'mine'); // shelves start empty
  assert.equal((await call('/settings', { method: 'PUT', cookie, body: { settings: { wood: 'url(javascript:x)' } } })).status, 400);
  assert.equal((await call('/settings', { method: 'PUT', cookie, body: { settings: { evil: 'x' } } })).status, 400);
  assert.equal((await call('/settings')).status, 401);
});

// A tiny valid PNG header is enough for the server's type check; the client sends the real, resized photo.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
async function putSpine(id, cookie, body, headers = {}) {
  const res = await fetch(`${base}/api/library/${id}/spine`, {
    method: 'PUT', body,
    headers: { 'Content-Type': 'image/png', 'X-Image-Width': '100', 'X-Image-Height': '500', Origin: base, Cookie: cookie, ...headers },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test("a reader's own spine photo is stored, served only to them, and removed with the book", async () => {
  const a = await signup('spine-a@example.com');
  const b = await signup('spine-b@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie: a })).json.results[0];
  const book = (await call('/library', { method: 'POST', cookie: a, body: { book: search, status: 'read' } })).json.book;
  assert.equal(book.spineV, null);

  const put = await putSpine(book.id, a, PNG);
  assert.equal(put.status, 200);
  assert.equal(put.json.book.spineW, 100);
  assert.ok(put.json.book.spineV);

  const mine = await fetch(`${base}/api/library/${book.id}/spine`, { headers: { Cookie: a } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await mine.arrayBuffer()).length, PNG.length);
  assert.equal((await fetch(`${base}/api/library/${book.id}/spine`, { headers: { Cookie: b } })).status, 404);
  assert.equal((await putSpine(book.id, b, PNG)).status, 404);

  // wrong content, wrong shape, or wrong size is refused
  assert.equal((await putSpine(book.id, a, Buffer.alloc(300, 1))).status, 400);
  assert.equal((await putSpine(book.id, a, PNG, { 'X-Image-Width': '500', 'X-Image-Height': '100' })).status, 400);
  assert.equal((await putSpine(book.id, a, PNG, { 'X-Image-Width': 'abc' })).status, 400);

  assert.equal((await call(`/library/${book.id}/spine`, { method: 'DELETE', cookie: a })).json.book.spineV, null);
  await putSpine(book.id, a, PNG);
  await call(`/library/${book.id}`, { method: 'DELETE', cookie: a });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM spines WHERE book_id = ?', [book.id])).n, 0);
});

test('reading progress is tracked, validated, logged and finishes with the book', async () => {
  const cookie = await signup('progress@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie })).json.results[0];
  const id = (await call('/library', { method: 'POST', cookie, body: { book: search, status: 'reading' } })).json.book.id;
  const patch = (body) => call(`/library/${id}`, { method: 'PATCH', cookie, body });

  const first = await patch({ currentPage: 120 });
  assert.equal(first.json.book.currentPage, 120);
  assert.equal((await patch({ currentPage: 301 })).status, 400); // past the last page (300)
  assert.equal((await patch({ currentPage: -1 })).status, 400);
  assert.equal((await patch({ currentPage: 1.5 })).status, 400);
  assert.equal((await patch({ pages: 0 })).status, 400);
  await patch({ currentPage: 200 });

  const log = (await call(`/library/${id}/log`, { cookie })).json.log;
  assert.deepEqual(log.map((e) => [e.page, e.delta]), [[120, 120], [200, 80]]);

  // correcting the total pulls the page back inside the book
  assert.equal((await patch({ pages: 150 })).json.book.currentPage, 150);
  // finishing puts the reader on the last page
  const done = await patch({ status: 'read' });
  assert.equal(done.json.book.currentPage, 150);

  // another reader cannot see this diary
  const other = await signup('progress2@example.com');
  assert.equal((await call(`/library/${id}/log`, { cookie: other })).status, 404);
});

test('barcodes: ISBNs are checked and looked up, and unknown ones are reported', async () => {
  assert.equal(normIsbn('978-0-547-92822-7'), '9780547928227');
  assert.equal(normIsbn('054792822X'), '9780547928227'); // the ISBN-10 form of the same book
  assert.equal(normIsbn('9780547928228'), null); // wrong check digit
  assert.equal(normIsbn('hello'), null);
  const cookie = await signup('scan@example.com');
  const hit = await call('/books/isbn/9780547928227', { cookie });
  assert.equal(hit.status, 200);
  assert.equal(hit.json.result.title, 'The Hobbit');
  assert.equal(hit.json.result.isbn, '9780547928227');
  assert.equal((await call('/books/isbn/9780547928228', { cookie })).status, 400);
  assert.equal((await call('/books/isbn/9780547928227')).status, 401);
});

test('series are found from catalog lines, subjects and titles, and saved with the book', async () => {
  assert.deepEqual(detectSeries({ editionSeries: ['Harry Potter ; 3'] }), { series: 'Harry Potter', seriesNo: 3 });
  assert.deepEqual(detectSeries({ editionSeries: ['The Hunger Games, #2'] }), { series: 'The Hunger Games', seriesNo: 2 });
  assert.deepEqual(detectSeries({ title: 'Mistborn (The Mistborn Saga, Book 1)' }), { series: 'The Mistborn Saga', seriesNo: 1 });
  assert.deepEqual(detectSeries({ subjects: ['Fantasy', 'series:Discworld'] }), { series: 'Discworld', seriesNo: null });
  assert.deepEqual(detectSeries({ title: 'Emma', subjects: ['Romance'] }), { series: null, seriesNo: null });
  assert.deepEqual(detectSeries({ subjects: ['series:SparkNotes_Literature_Guide'] }), { series: null, seriesNo: null }); // an imprint, not a series
  assert.deepEqual(detectSeries({ subjects: ['series:Penguin_Classics', 'series:Dune'] }), { series: 'Dune', seriesNo: null });
  const cookie = await signup('series@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie })).json.results[0];
  const added = await call('/library', { method: 'POST', cookie, body: { book: { ...search, series: 'Middle-earth', seriesNo: 0 }, status: 'want' } });
  assert.equal(added.json.book.series, 'Middle-earth');
  assert.equal(added.json.book.seriesNo, 0);
  const org = await call('/library/series', { method: 'POST', cookie });
  assert.equal(org.status, 200);
  assert.equal(org.json.books[0].series, 'Middle-earth');
});

test('a book can be made thicker, thinner, taller or shorter on the shelf, within sensible limits', async () => {
  const cookie = await signup('size@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie })).json.results[0];
  const id = (await call('/library', { method: 'POST', cookie, body: { book: search, status: 'read' } })).json.book.id;
  const patch = (body) => call(`/library/${id}`, { method: 'PATCH', cookie, body });
  const ok = await patch({ thick: 1.5, tall: 0.8 });
  assert.equal(ok.json.book.thick, 1.5);
  assert.equal(ok.json.book.tall, 0.8);
  for (const bad of [{ thick: 0.1 }, { thick: 5 }, { tall: 2 }, { tall: 'big' }]) assert.equal((await patch(bad)).status, 400);
  assert.equal((await patch({ thick: null, tall: null })).json.book.thick, null);
});

test('finishing a book earns coins once; coins buy plants that can be placed anywhere inside the library', async () => {
  const cookie = await signup('coins@example.com');
  const search = (await call('/books/search?q=the hobbit', { cookie })).json.results[0];
  assert.equal((await call('/economy', { cookie })).json.coins, 0);
  const add = await call('/library', { method: 'POST', cookie, body: { book: search, status: 'want' } });
  assert.equal(add.json.reward, null);
  const id = add.json.book.id;
  const finish = await call(`/library/${id}`, { method: 'PATCH', cookie, body: { status: 'read' } });
  assert.equal(finish.json.reward.amount, 17); // 10 + 300 pages / 40
  assert.equal(finish.json.reward.balance, 17);
  // reading it again, or removing it and adding it back finished, earns nothing more
  await call(`/library/${id}`, { method: 'PATCH', cookie, body: { status: 'reading' } });
  assert.equal((await call(`/library/${id}`, { method: 'PATCH', cookie, body: { status: 'read' } })).json.reward, null);
  await call(`/library/${id}`, { method: 'DELETE', cookie });
  assert.equal((await call('/library', { method: 'POST', cookie, body: { book: search, status: 'read' } })).json.reward, null);
  assert.equal((await call('/economy', { cookie })).json.coins, 17);

  // the shop: only known items, only with enough coins, and the price is the server's
  assert.equal((await call('/shop/buy', { method: 'POST', cookie, body: { kind: 'unicorn' } })).status, 400);
  assert.equal((await call('/shop/buy', { method: 'POST', cookie, body: { kind: 'palm', price: 1 } })).status, 402);
  const bought = await call('/shop/buy', { method: 'POST', cookie, body: { kind: 'succulent' } });
  assert.equal(bought.status, 201);
  assert.equal(bought.json.coins, 7);
  assert.equal((await call('/shop/buy', { method: 'POST', cookie, body: { kind: 'cactus' } })).status, 402);

  // placing: anywhere inside the room, never outside it, and only your own things
  const itemId = bought.json.item.id;
  const spot = { x: 2.5, y: 0.75, z: -3.2, ry: 1.2, s: 1.1 };
  const placed = await call(`/items/${itemId}`, { method: 'PATCH', cookie, body: { placed: spot } });
  assert.deepEqual(placed.json.item.placed, spot);
  for (const bad of [{ ...spot, x: 99 }, { ...spot, y: 50 }, { ...spot, s: 9 }, { ...spot, z: 'far' }, { x: 1 }]) assert.equal((await call(`/items/${itemId}`, { method: 'PATCH', cookie, body: { placed: bad } })).status, 400);
  assert.deepEqual((await call('/economy', { cookie })).json.items, [{ id: itemId, kind: 'succulent', placed: spot }]);
  assert.equal((await call(`/items/${itemId}`, { method: 'PATCH', cookie, body: { placed: null } })).json.item.placed, null);
  const other = await signup('coins-other@example.com');
  assert.equal((await call(`/items/${itemId}`, { method: 'PATCH', cookie: other, body: { placed: spot } })).status, 404);
  assert.equal((await call('/economy', { cookie: other })).json.coins, 0);
  assert.equal((await call('/shop/buy', { method: 'POST', cookie: other, body: { kind: 'succulent' } })).status, 402);
});
