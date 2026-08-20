/**
 * Tiny fetch wrapper. Injects the Bearer token, normalizes JSON errors,
 * and returns typed results.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

const TOKEN_KEY = 'prokashoni-crm-token-v1';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 204) return undefined as T;

  const bodyText = await res.text();
  const body = bodyText ? safeParse(bodyText) : undefined;

  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    // If the token has expired, wipe it so the app pushes the user to /login.
    if (res.status === 401) setToken(null);
    throw new Error(msg);
  }
  return body as T;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
