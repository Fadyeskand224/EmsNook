/** Books on the shelf, in display order. Books that were never placed come first (newest on top), then the placed ones. */
export function shelfSort(books) {
  const shelved = books.filter((b) => b.status !== 'want');
  const fallback = (a, b) =>
    a.status === b.status ? (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0) : a.status === 'reading' ? -1 : 1;
  const fresh = shelved.filter((b) => b.shelfPos == null).sort(fallback);
  const placed = shelved.filter((b) => b.shelfPos != null).sort((a, b) => a.shelfPos - b.shelfPos);
  return [...fresh, ...placed];
}

/** Puts `shownOrder` (a possibly filtered subset) back into the full list, keeping every other book where it was. */
export function mergeOrder(allIds, shownOrder) {
  const inShown = new Set(shownOrder);
  let k = 0;
  return allIds.map((id) => (inShown.has(id) ? shownOrder[k++] : id));
}
