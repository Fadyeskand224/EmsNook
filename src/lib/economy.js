import { api } from './api';

export const fetchEconomy = () => api('/economy');
export const buyItem = (kind) => api('/shop/buy', { method: 'POST', body: { kind } });
export const placeItem = async (id, placed) => (await api(`/items/${id}`, { method: 'PATCH', body: { placed } })).item;
