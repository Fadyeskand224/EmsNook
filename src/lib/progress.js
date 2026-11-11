// Reading progress maths, kept apart from the screen so it is easy to check.
const DAY = 86400000;
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };

export const percentOf = (book) => (book.pages ? Math.min(100, Math.round(((book.currentPage || 0) / book.pages) * 100)) : null);

/** Pace, finish estimate, streak and the last fourteen days, from the diary (oldest first). */
export function summarize(book, log, now = Date.now()) {
  const pct = percentOf(book);
  const left = book.pages ? Math.max(0, book.pages - (book.currentPage || 0)) : null;
  const gains = log.filter((e) => e.delta > 0);

  const days = Array.from({ length: 14 }, (_, i) => ({ key: dayKey(now - (13 - i) * DAY), t: now - (13 - i) * DAY, pages: 0 }));
  for (const e of gains) {
    const d = days.find((x) => x.key === dayKey(e.at));
    if (d) d.pages += e.delta;
  }

  // pace: pages per day over the recent window, counting only the days since the reader began logging
  let pace = null;
  const recent = gains.filter((e) => e.at > now - 14 * DAY);
  if (recent.length) {
    const span = Math.min(14, Math.max(1, Math.ceil((now - recent[0].at) / DAY)));
    pace = Math.round((recent.reduce((s, e) => s + e.delta, 0) / Math.max(span, 1)) * 10) / 10;
  }
  const finishAt = pace && left ? now + Math.ceil(left / pace) * DAY : null;

  // streak: days in a row with some reading, still alive if the reader read yesterday
  const readDays = new Set(gains.map((e) => dayKey(e.at)));
  let streak = 0;
  let t = readDays.has(dayKey(now)) ? now : now - DAY;
  while (readDays.has(dayKey(t))) { streak += 1; t -= DAY; }

  const today = days[13].pages;
  return { pct, left, pace, finishAt, streak, days, today, best: Math.max(1, ...days.map((d) => d.pages)) };
}

export const MILESTONES = [25, 50, 75];
/** The milestone (if any) crossed when moving from one percentage to another. */
export const crossed = (from, to) => (from == null || to == null ? null : [...MILESTONES, 100].filter((m) => from < m && to >= m).pop() ?? null);
