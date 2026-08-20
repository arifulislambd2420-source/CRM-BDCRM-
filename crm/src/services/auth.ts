/**
 * Auth service. Talks to /api/auth on the backend.
 * Frontend components import the same shape as before, so callers didn't move.
 */
import type { AuthUser } from '../types';
import { apiFetch, setToken } from './api';
import { bootstrap, dataStore } from './store';

const SESSION_KEY = 'prokashoni-crm-session-v1';

export async function login(email: string, password: string): Promise<AuthUser> {
  const { user, token } = await apiFetch<{ user: AuthUser; token: string }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  setToken(token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  await bootstrap();
  return user;
}

export function logout(): void {
  setToken(null);
  localStorage.removeItem(SESSION_KEY);
  dataStore.reset();
}

/** Return the cached session; AuthContext still validates it against /session. */
export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Ask the backend to confirm the token is still valid; returns fresh AuthUser or null. */
export async function verifySession(): Promise<AuthUser | null> {
  try {
    const { user } = await apiFetch<{ user: AuthUser }>('/api/auth/session');
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}
