import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizeOrder, withInferredSeries } from '../../src/lib/series.js';

const b = (id, title, o = {}) => ({ id, title, authors: [o.author || 'Someone Else'], year: o.year ?? null, series: o.series ?? null, seriesNo: o.no ?? null });
const titles = (list) => list.ordered.map((x) => x.book.title);

test('a series is shelved together in release order, then the standalone books by author', () => {
  const books = [
    b(1, 'Pride and Prejudice', { author: 'Jane Austen', year: 1813 }),
    b(2, 'Catching Fire', { author: 'Suzanne Collins', series: 'The Hunger Games', no: 2, year: 2009 }),
    b(3, 'Beloved', { author: 'Toni Morrison', year: 1987 }),
    b(4, 'The Hunger Games', { author: 'Suzanne Collins', series: 'The Hunger Games', no: 1, year: 2008 }),
    b(5, 'Mockingjay', { author: 'Suzanne Collins', series: 'Hunger Games series', no: 3, year: 2010 }),
  ];
  const r = organizeOrder(books);
  assert.deepEqual(titles(r), ['The Hunger Games', 'Catching Fire', 'Mockingjay', 'Pride and Prejudice', 'Beloved']);
  assert.equal(r.seriesCount, 1);
});

test('without volume numbers a series follows the year each book came out', () => {
  const books = [
    b(1, 'Harry Potter and the Prisoner of Azkaban', { author: 'J.K. Rowling', year: 1999, series: 'Harry Potter' }),
    b(2, "Harry Potter and the Philosopher's Stone", { author: 'J.K. Rowling', year: 1997, series: 'Harry Potter' }),
    b(3, 'Harry Potter and the Chamber of Secrets', { author: 'J.K. Rowling', year: 1998, series: 'Harry Potter' }),
  ];
  assert.deepEqual(titles(organizeOrder(books)), ["Harry Potter and the Philosopher's Stone", 'Harry Potter and the Chamber of Secrets', 'Harry Potter and the Prisoner of Azkaban']);
});

test('books that share a title start and an author are treated as one series even when the catalog does not say so', () => {
  const books = [
    b(1, 'Harry Potter and the Chamber of Secrets', { author: 'J.K. Rowling', year: 1998 }),
    b(2, 'Dune Messiah', { author: 'Frank Herbert', year: 1969 }),
    b(3, "Harry Potter and the Philosopher's Stone", { author: 'J.K. Rowling', year: 1997 }),
    b(4, 'Dune', { author: 'Frank Herbert', year: 1965 }),
    b(5, 'Emma', { author: 'Jane Austen', year: 1815 }),
  ];
  const inferred = withInferredSeries(books);
  assert.equal(inferred.find((x) => x.id === 1).series, 'Harry Potter');
  assert.equal(inferred.find((x) => x.id === 4).series, 'Dune');
  assert.equal(inferred.find((x) => x.id === 5).series, null);
  assert.deepEqual(titles(organizeOrder(books)), ['Dune', 'Dune Messiah', "Harry Potter and the Philosopher's Stone", 'Harry Potter and the Chamber of Secrets', 'Emma']);
});

test('a lone book from a series goes with the standalone books, and volume numbers in titles are used', () => {
  const books = [
    b(1, 'Book 3: The Third', { author: 'A Writer', series: 'Trio', year: 2003 }),
    b(2, 'Book 1: The First', { author: 'A Writer', series: 'Trio', year: 2001 }),
    b(3, 'Book 2: The Second', { author: 'A Writer', series: 'Trio', year: 2002 }),
    b(4, 'Only One', { author: 'Zed Zed', series: 'Lonely Saga', year: 2000 }),
  ];
  const r = organizeOrder(books);
  assert.deepEqual(titles(r), ['Book 1: The First', 'Book 2: The Second', 'Book 3: The Third', 'Only One']);
  assert.equal(r.ordered[3].series, false);
});

test('a book without a series joins the series its neighbours already have', () => {
  const books = [
    b(1, "Harry Potter and the Philosopher's Stone", { author: 'J.K. Rowling', year: 1997, series: 'Harry Potter' }),
    b(2, 'Harry Potter and the Prisoner of Azkaban', { author: 'J.K. Rowling', year: 1999 }),
    b(3, 'Dune', { author: 'Frank Herbert', year: 1965, series: 'Dune' }),
    b(4, 'Dune Messiah', { author: 'Frank Herbert', year: 1969 }),
    b(5, 'Emma', { author: 'Jane Austen', year: 1815 }),
  ];
  const r = organizeOrder(books);
  assert.deepEqual(titles(r), ['Dune', 'Dune Messiah', "Harry Potter and the Philosopher's Stone", 'Harry Potter and the Prisoner of Azkaban', 'Emma']);
  assert.equal(r.seriesCount, 2);
});
