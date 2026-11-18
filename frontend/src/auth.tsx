import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Settings, User } from './types';

type AuthState = {
  user: User | null;
  settings: Settings | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSettings: (settings: Settings) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.me();
      setUser(response.user);
      setSettingsState(response.settings);
    } catch {
      setUser(null);
      setSettingsState(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password);
    setUser(response.user);
    setSettingsState(response.settings);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const response = await api.register(username, password);
    setUser(response.user);
    setSettingsState(response.settings);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setSettingsState(null);
    }
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, settings, loading, login, register, logout, refresh,
    setSettings: setSettingsState,
  }), [user, settings, loading, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider отсутствует');
  return value;
}
