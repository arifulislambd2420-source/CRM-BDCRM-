/**
 * Client-side snapshot of server state.
 *
 * Reads are synchronous via useSyncExternalStore, so components see a
 * consistent snapshot. Mutations go through the API (in the other service
 * files) and update this snapshot on success. `bootstrap()` fills it after
 * login or on app boot when a token exists.
 */
import type { Customer, Pipeline, SettingsData, Store, User } from '../types';
import { apiFetch, getToken } from './api';

interface DB {
  users: User[];
  customers: Customer[];
  stores: Store[];
  pipelines: Pipeline[];
  settings: SettingsData;
  loaded: boolean;
}

function empty(): DB {
  return {
    users: [], customers: [], stores: [], pipelines: [],
    settings: { sources: [] }, loaded: false,
  };
}

let db: DB = empty();

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(): void {
  listeners.forEach((l) => l());
}

export const dataStore = {
  getUsers: () => db.users,
  getCustomers: () => db.customers,
  getStores: () => db.stores,
  getPipelines: () => db.pipelines,
  getSettings: () => db.settings,
  isLoaded: () => db.loaded,
  setUsers: (v: User[]) => { db = { ...db, users: v }; emit(); },
  setCustomers: (v: Customer[]) => { db = { ...db, customers: v }; emit(); },
  setStores: (v: Store[]) => { db = { ...db, stores: v }; emit(); },
  setPipelines: (v: Pipeline[]) => { db = { ...db, pipelines: v }; emit(); },
  setSettings: (v: SettingsData) => { db = { ...db, settings: v }; emit(); },
  reset: () => { db = empty(); emit(); },
};

/** Fetch all reference data. Call after login or on app boot with a session. */
export async function bootstrap(): Promise<void> {
  const [users, customers, stores, pipelines, settings] = await Promise.all([
    apiFetch<User[]>('/api/users'),
    apiFetch<Customer[]>('/api/customers'),
    apiFetch<Store[]>('/api/stores'),
    apiFetch<Pipeline[]>('/api/pipelines'),
    apiFetch<SettingsData>('/api/settings'),
  ]);
  db = { users, customers, stores, pipelines, settings, loaded: true };
  emit();
}

/** Refetch just the customer list — used after any customer/note mutation. */
export async function refreshCustomers(): Promise<void> {
  const customers = await apiFetch<Customer[]>('/api/customers');
  db = { ...db, customers };
  emit();
}

/** Refetch just the users roster — used after user mgmt mutations. */
export async function refreshUsers(): Promise<void> {
  const users = await apiFetch<User[]>('/api/users');
  db = { ...db, users };
  emit();
}
export async function refreshStores(): Promise<void> {
  const stores = await apiFetch<Store[]>('/api/stores');
  db = { ...db, stores };
  emit();
}
export async function refreshPipelines(): Promise<void> {
  const pipelines = await apiFetch<Pipeline[]>('/api/pipelines');
  db = { ...db, pipelines };
  emit();
}
export async function refreshSettings(): Promise<void> {
  const settings = await apiFetch<SettingsData>('/api/settings');
  db = { ...db, settings };
  emit();
}

// If a token already exists on module load, warm the cache eagerly.
// AuthContext will still gate rendering on session validity.
if (getToken()) {
  bootstrap().catch(() => {
    /* handled by AuthContext when it validates the session */
  });
}
