import crypto from 'node:crypto';

/**
 * Failed-attempt tracker used for account lockout. State lives in the database, so it survives
 * restarts and the host going to sleep. Keys are hashed before storage, and unknown emails are
 * treated exactly like real ones so lockouts never reveal which accounts exist.
 */
export function createAttemptTracker(db, { scope, max = 5, windowMs = 15 * 60e3, lockMs = 15 * 60e3, now = Date.now } = {}) {
  const hashKey = (key) => crypto.createHash('sha256').update(`${scope}:${key}`).digest('hex');

  return {
    async isLocked(key) {
      const row = await db.get('SELECT locked_until FROM attempts WHERE key = ?', [hashKey(key)]);
      return !!row && row.locked_until > now();
    },
    async fail(key) {
      const k = hashKey(key);
      const t = now();
      const row = await db.get('SELECT count, first_at, locked_until FROM attempts WHERE key = ?', [k]);
      const fresh = !row || (row.locked_until < t && t - row.first_at > windowMs);
      const count = fresh ? 1 : row.count + 1;
      const firstAt = fresh ? t : row.first_at;
      const lockedUntil = count >= max ? t + lockMs : fresh ? 0 : row.locked_until;
      await db.run(
        `INSERT INTO attempts (key, count, first_at, locked_until) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET count = excluded.count, first_at = excluded.first_at, locked_until = excluded.locked_until`,
        [k, count, firstAt, lockedUntil]
      );
    },
    async reset(key) {
      await db.run('DELETE FROM attempts WHERE key = ?', [hashKey(key)]);
    },
  };
}
