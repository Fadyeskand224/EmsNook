// Series ordering for the shelves. The catalog names a series for some books; for the rest we notice when a reader owns
// several books that share a title start and an author ("Harry Potter and the …"), so a series is kept together either way.
const STOP = new Set(['and', 'the', 'of', 'a', 'an', 'in', 'to', 'or', '&']);
const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
export const authorKey = (b) => clean((b.authors?.[0] || '').split(/\s+/).slice(-1)[0]);

/** Same series, however it is written ("The Hunger Games", "Hunger Games series"). */
export const seriesKey = (name) => clean(name).replace(/\b(the|series|saga|trilogy|chronicles|cycle|books?)\b/g, '').replace(/\s+/g, ' ').trim();

/** A volume number from the title when the catalog gave none: "Book 2", "Vol. 3", "#4". */
export function titleNumber(title) {
  const m = String(title).match(/(?:book|vol(?:ume)?\.?|part|no\.?|#)\s*(\d{1,3})\b/i);
  return m ? Number(m[1]) : null;
}

/** Release order inside a series: its number if known, otherwise the year it came out, then the title. */
export const cmpVolume = (a, b) => {
  const na = a.seriesNo ?? titleNumber(a.title) ?? Infinity;
  const nb = b.seriesNo ?? titleNumber(b.title) ?? Infinity;
  if (na !== nb) return na - nb;
  const ya = a.year ?? Infinity; const yb = b.year ?? Infinity;
  if (ya !== yb) return ya - yb;
  return String(a.title).localeCompare(String(b.title));
};

/** Gives a series to books that have none but obviously share one with another book by the same author. */
export function withInferredSeries(books) {
  const out = books.map((b) => ({ ...b }));
  const byAuthor = new Map();
  out.forEach((b) => { const k = authorKey(b); if (k) byAuthor.set(k, [...(byAuthor.get(k) || []), b]); });
  for (const list of byAuthor.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i]; const B = list[j];
      if (A.series && B.series) continue; // both already named: leave them as the catalog says
      const wa = String(A.title).split(/\s+/); const wb = String(B.title).split(/\s+/);
      let n = 0;
      while (n < wa.length && n < wb.length && clean(wa[n]) === clean(wb[n])) n += 1;
      while (n > 0 && STOP.has(clean(wa[n - 1]))) n -= 1; // "Harry Potter and the" -> "Harry Potter"
      if (n === 0) continue;
      const wholeTitle = n === wa.length || n === wb.length; // "Dune" and "Dune Messiah"
      if (n < 2 && !wholeTitle) continue;
      const name = A.series || B.series || wa.slice(0, n).join(' ').replace(/[:,\-–]+$/, '');
      for (const b of [A, B]) if (!b.series) { b.series = name; b._inferred = true; }
    }
  }
  return out;
}

/**
 * Every book in shelf order: each series together in release order, series A to Z, then books that are not part of one,
 * by author and title. A lone book of a series is shelved with the standalone books.
 */
export function organizeOrder(books) {
  const list = withInferredSeries(books);
  const counts = new Map();
  list.forEach((b) => { if (b.series) counts.set(seriesKey(b.series), (counts.get(seriesKey(b.series)) || 0) + 1); });
  const inSeries = (b) => b.series && counts.get(seriesKey(b.series)) > 1;
  const series = list.filter(inSeries);
  const rest = list.filter((b) => !inSeries(b));
  series.sort((a, b) => {
    const ka = seriesKey(a.series); const kb = seriesKey(b.series);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return cmpVolume(a, b);
  });
  rest.sort((a, b) => authorKey(a).localeCompare(authorKey(b)) || String(a.title).localeCompare(String(b.title)));
  const ordered = [...series, ...rest];
  const names = new Set(series.map((b) => seriesKey(b.series)));
  return { ordered: ordered.map((b) => ({ book: books.find((o) => o.id === b.id), series: inSeries(b), group: inSeries(b) ? `s:${seriesKey(b.series)}` : `#${b.id}` })), seriesCount: names.size };
}
