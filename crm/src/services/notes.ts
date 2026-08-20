import type { AuthUser, Note } from '../types';
import { apiFetch } from './api';
import { refreshCustomers } from './store';

/**
 * Client-side permission preview (matches the server rule so we can hide the
 * edit/delete controls). Server enforces this independently in routes/notes.ts.
 */
export function canModifyNote(user: AuthUser, note: Note): boolean {
  if (user.role === 'admin') return true;
  if (note.createdById !== user.id) return false;
  return user.canEditOwnNotes === true;
}

export async function addNote(
  _user: AuthUser,
  customerId: string,
  text: string,
): Promise<Note> {
  const created = await apiFetch<Note>(
    `/api/customers/${encodeURIComponent(customerId)}/notes`,
    { method: 'POST', body: JSON.stringify({ text }) },
  );
  await refreshCustomers();
  return created;
}

export async function updateNote(
  _user: AuthUser,
  customerId: string,
  noteId: string,
  text: string,
): Promise<void> {
  await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
    { method: 'PATCH', body: JSON.stringify({ text }) },
  );
  await refreshCustomers();
}

export async function deleteNote(
  _user: AuthUser,
  customerId: string,
  noteId: string,
): Promise<void> {
  await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
    { method: 'DELETE' },
  );
  await refreshCustomers();
}
