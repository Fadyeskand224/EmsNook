import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// scrypt (memory-hard), parameters from the OWASP Password Storage Cheat Sheet
// (N=2^15, r=8, p=3). N can be lowered by tests via SCRYPT_N to keep them fast.
const N = Number(process.env.SCRYPT_N) || 2 ** 15;
const R = 8;
const P = 3;
const KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Constant-time check. Parameters are read from the stored hash so they can be upgraded later. */
export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return crypto.timingSafeEqual(key, expected);
}

// Unknown emails still pay the full hashing cost, so response time doesn't reveal which accounts exist.
let dummy;
export async function dummyVerify(password) {
  dummy ||= await hashPassword(crypto.randomBytes(12).toString('hex'));
  await verifyPassword(password, dummy);
  return false;
}

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', '12345678', '123456789', '1234567890', '11111111', '00000000',
  'qwerty123', 'qwertyuiop', 'qwerty12', '1q2w3e4r', '1q2w3e4r5t', 'iloveyou', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'admin123',
  'abc12345', 'abcd1234', 'monkey123', 'dragon123', 'football1', 'baseball1', 'sunshine1', 'princess1', 'superman1', 'trustno1', 'changeme',
  'emsnook1', 'emsnook123', 'bookworm1', 'readmore1', 'zaq12wsx', 'master123', 'login1234', 'whatever1', 'starwars1', 'passpass1',
]);

/** Returns an error string, or null if the password is acceptable. */
export function passwordProblem(password, { email = '', name = '' } = {}) {
  if (typeof password !== 'string') return 'Enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return 'That password is too common. Choose something harder to guess.';
  const local = email.split('@')[0].toLowerCase();
  if ((local.length >= 4 && lower.includes(local)) || (name.trim().length >= 4 && lower.includes(name.trim().toLowerCase()))) {
    return 'Password should not contain your name or email.';
  }
  return null;
}
