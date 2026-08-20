import type { SettingsData } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshSettings } from './store';

export function getSettings(): SettingsData {
  return dataStore.getSettings();
}

export async function updateSources(sources: string[]): Promise<void> {
  await apiFetch<SettingsData>('/api/settings/sources', {
    method: 'PUT',
    body: JSON.stringify({ sources }),
  });
  await refreshSettings();
}
