import type { AuthUser, Customer } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshCustomers } from './store';

/**
 * `getCustomers(user)` still returns a sync array — a snapshot of the local
 * cache filtered by role, matching the previous mock signature so components
 * that call it inside useMemo don't have to change.
 * Store-manager scoping is ALSO enforced server-side; this is defense in depth.
 */
export function getCustomers(user: AuthUser): Customer[] {
  const all = dataStore.getCustomers();
  if (user.role === 'store_manager') {
    return all.filter((c) => c.storeId === user.storeId);
  }
  return all;
}

export function getCustomer(user: AuthUser, id: string): Customer | undefined {
  return getCustomers(user).find((c) => c.id === id);
}

export async function createCustomer(
  _user: AuthUser,
  input: Omit<Customer, 'id' | 'createdAt' | 'createdById' | 'notes'> & { notes?: Customer['notes'] },
): Promise<Customer> {
  const created = await apiFetch<Customer>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await refreshCustomers();
  return created;
}

export async function updateCustomer(
  _user: AuthUser,
  id: string,
  patch: Partial<Customer>,
): Promise<Customer> {
  const updated = await apiFetch<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  await refreshCustomers();
  return updated;
}

export async function moveCustomerStage(
  user: AuthUser,
  customerId: string,
  pipelineId: string,
  stageId: string,
): Promise<Customer> {
  return updateCustomer(user, customerId, { pipelineId, currentStageId: stageId });
}

export async function deleteCustomer(_user: AuthUser, id: string): Promise<void> {
  await apiFetch(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshCustomers();
}
