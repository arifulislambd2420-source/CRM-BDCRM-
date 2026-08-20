import type { Store } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshStores } from './store';

export function getStores(): Store[] {
  return dataStore.getStores();
}

export async function createStore(name: string): Promise<Store> {
  const s = await apiFetch<Store>('/api/stores', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  await refreshStores();
  return s;
}

export async function updateStore(id: string, patch: Partial<Store>): Promise<void> {
  await apiFetch(`/api/stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  await refreshStores();
}

export async function deleteStore(id: string): Promise<void> {
  await apiFetch(`/api/stores/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshStores();
}
