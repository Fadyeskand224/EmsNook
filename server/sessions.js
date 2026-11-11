import crypto from 'node:crypto';

export const SESSION_DAYS = 14;
const DAY = 86400000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSessionStore(db) {
  return {
    /** Creates a session and returns the raw token (only its hash is stored). */
    async create(userId) {
      const token = crypto.randomBytes(32).toString('base64url');
      const now = Date.now();
      await db.run(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_used) VALUES (?, ?, ?, ?, ?)',
        [sha256(token), userId, now, now + SESSION_DAYS * DAY, now]
      );
      return token;
    },

    /** Looks a token up; extends the expiry at most once a day (sliding window). */
    async get(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const hash = sha256(token);
      const row = await db.get(
        `SELECT s.expires_at, s.last_used, u.id, u.email, u.name
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
        [hash]
      );
      if (!row) return null;
      const now = Date.now();
      if (row.expires_at < now) {
        await db.run('DELETE FROM sessions WHERE token_hash = ?', [hash]);
        return null;
      }
      if (now - row.last_used > DAY) {
        await db.run('UPDATE sessions SET last_used = ?, expires_at = ? WHERE token_hash = ?', [now, now + SESSION_DAYS * DAY, hash]);
      }
      return { hash, user: { id: row.id, email: row.email, name: row.name } };
    },

    destroy: (token) => db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]),
    destroyAllForUser: (userId) => db.run('DELETE FROM sessions WHERE user_id = ?', [userId]),
    prune: async () => {
      await db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
      await db.run('DELETE FROM attempts WHERE locked_until < ? AND first_at < ?', [Date.now(), Date.now() - 86400000]);
    },
  };
}
