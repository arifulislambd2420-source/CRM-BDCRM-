/**
 * Tiny fetch wrapper.
 * - Injects the current access token as a Bearer header
 * - On a 401 response, tries to swap the refresh token for a new pair once,
 *   then retries the original request
 * - Normalizes JSON errors and returns typed results
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

const ACCESS_KEY = 'prokashoni-crm-token-v1';       // access JWT
const REFRESH_KEY = 'prokashoni-crm-refresh-v1';    // refresh JWT

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(ACCESS_KEY, t);
  else localStorage.removeItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function setRefreshToken(t: string | null): void {
  if (t) localStorage.setItem(REFRESH_KEY, t);
  else localStorage.removeItem(REFRESH_KEY);
}
export function clearTokens(): void {
  setToken(null);
  setRefreshToken(null);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(BASE + '/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { accessToken: string; refreshToken: string };
        setToken(body.accessToken);
        setRefreshToken(body.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        // Free the slot so a later expiry can trigger a fresh refresh.
        setTimeout(() => { refreshInFlight = null; }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const token = getToken();
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = {
    // Let the browser set the multipart boundary for FormData.
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return fetch(BASE + path, { ...init, headers });
}

/** Resolve an image path returned by the API (e.g. "products/abc.jpg") to a full URL. */
export function uploadUrl(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  return `${BASE}/uploads/${relPath.replace(/^\/+/, '')}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res = await rawFetch(path, init);

  // One retry with a rotated refresh token if the access token is expired.
  if (res.status === 401 && getRefreshToken()) {
    const ok = await refreshOnce();
    if (ok) {
      res = await rawFetch(path, init);
    } else {
      clearTokens();
    }
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? safeParse(text) : undefined;
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    if (res.status === 401) clearTokens();
    throw new Error(msg);
  }
  return body as T;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
