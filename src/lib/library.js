import { api, ApiError } from './api';

export const searchBooks = async (q, signal) => (await api(`/books/search?q=${encodeURIComponent(q)}`, { signal })).results;
export const fetchLibrary = async () => (await api('/library')).books;
export const addBook = async (book, status) => (await api('/library', { method: 'POST', body: { book, status } })).book;
export const updateBook = async (id, patch) => (await api(`/library/${id}`, { method: 'PATCH', body: patch })).book;
export const lookupIsbn = async (isbn) => (await api(`/books/isbn/${encodeURIComponent(isbn)}`)).result;
export const fetchSeries = async () => (await api('/library/series', { method: 'POST' })).books;
export const fetchLog = async (id) => (await api(`/library/${id}/log`)).log;
export const refreshBook = async (id) => (await api(`/library/${id}/refresh`, { method: 'POST' })).book;
export const removeBook = (id) => api(`/library/${id}`, { method: 'DELETE' });

export const savePlaces = (places) => api('/library/places', { method: 'PUT', body: { places } });
export const reorderLibrary = (ids) => api('/library/order', { method: 'PUT', body: { ids } });
export const fetchSettings = async () => (await api('/settings')).settings;
export const saveSettings = async (settings) => (await api('/settings', { method: 'PUT', body: { settings } })).settings;

/** Uploads the (already cropped and resized) spine photo. */
export async function uploadSpine(id, blob, w, h) {
  let res;
  try {
    res = await fetch(`/api/library/${id}/spine`, {
      method: 'PUT', credentials: 'same-origin', body: blob,
      headers: { 'Content-Type': blob.type, 'X-Image-Width': String(w), 'X-Image-Height': String(h) },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error || 'Could not save that photo.', res.status);
  return json.book;
}
export const removeSpine = async (id) => (await api(`/library/${id}/spine`, { method: 'DELETE' })).book;
