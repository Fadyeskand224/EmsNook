export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // 0 = could not reach the server
  }
}

let onUnauthorized = null;
/** Called when a request that needs a login comes back 401 (e.g. the session expired). */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const NO_REDIRECT_ON_401 = new Set(['/auth/login', '/auth/signup', '/auth/me', '/auth/password', '/auth/account']);

export async function api(path, { method = 'GET', body, keepalive = false, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401 && !NO_REDIRECT_ON_401.has(path) && onUnauthorized) onUnauthorized();
    throw new ApiError(json?.error || 'Something went wrong. Please try again.', res.status);
  }
  return json;
}
