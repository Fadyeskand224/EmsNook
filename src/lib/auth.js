// Accounts live on the server. The browser only holds an HttpOnly session cookie, which
// JavaScript cannot read, so no password, hash or token is ever stored in the page.
import { api, ApiError } from './api';

export const signUp = async ({ name, email, password, confirm }) =>
  (await api('/auth/signup', { method: 'POST', body: { name, email, password, confirm } })).user;

/** Asks for a reset link. The answer is always the same, whether or not the email has an account. */
export const forgotPassword = async (email) => (await api('/auth/forgot', { method: 'POST', body: { email } })).message;

export const resetPassword = async ({ token, password, confirm }) =>
  (await api('/auth/reset', { method: 'POST', body: { token, password, confirm } })).user;

export const logIn = async ({ email, password }) =>
  (await api('/auth/login', { method: 'POST', body: { email, password } })).user;

/** The logged-in user, or null when there is no valid session. Network errors are thrown. */
export async function fetchCurrentUser() {
  try {
    return (await api('/auth/me')).user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function logOut() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    /* the cookie expires on its own */
  }
}

/** Downloads everything we hold about the user as a JSON file. */
export async function downloadMyData() {
  const res = await fetch('/api/auth/export', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not download your data. Please try again.');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: 'emsnook-my-data.json' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
