import type { Role, User } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshUsers } from './store';

export function getUsers(): User[] {
  return dataStore.getUsers();
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  storeId?: string;
  canEditOwnNotes?: boolean;
}): Promise<User> {
  const u = await apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await refreshUsers();
  return u;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<void> {
  await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  await refreshUsers();
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshUsers();
}
