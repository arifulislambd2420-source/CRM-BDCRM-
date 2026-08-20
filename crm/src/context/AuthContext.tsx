import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types';
import {
  getSession,
  login as loginService,
  logout as logoutService,
  verifySession,
} from '../services/auth';
import { bootstrap } from '../services/store';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getSession();
    if (!cached) {
      setLoading(false);
      return;
    }
    // Validate the token against the server. If valid, warm the data cache.
    (async () => {
      try {
        const fresh = await verifySession();
        if (fresh) {
          setUser(fresh);
          await bootstrap();
        }
      } catch {
        // ignore — user stays logged out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const u = await loginService(email, password);
    setUser(u);
    return u;
  };

  const logout = () => {
    logoutService();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
