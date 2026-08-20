/**
 * Auth service. Talks to /api/auth on the backend.
 * Uses an access + refresh token pair; the fetch wrapper in api.ts handles
 * the rotation transparently.
 */
import type { AuthUser } from '../types';
import {
  apiFetch,
  clearTokens,
  getRefreshToken,
  setRefreshToken,
  setToken,
} from './api';
import { bootstrap, dataStore } from './store';

const SESSION_KEY = 'prokashoni-crm-session-v1';

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { user, accessToken, refreshToken } = await apiFetch<LoginResponse>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  setToken(accessToken);
  setRefreshToken(refreshToken);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  await bootstrap();
  return user;
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (refresh) {
    // Best-effort — even if this fails we still clear the client state.
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => {});
  }
  clearTokens();
  localStorage.removeItem(SESSION_KEY);
  dataStore.reset();
}

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

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
