import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { authStorage } from '../services/authStorage';
import type { CurrentUser, Permission } from '../services/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: CurrentUser | null;
  permissions: Permission[];
  status: AuthStatus;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<CurrentUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const logout = useCallback(async () => {
    try {
      await apiService.logout();
    } finally {
      setUser(null);
      setPermissions([]);
      setStatus('anonymous');
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<CurrentUser | null> => {
    try {
      const storedRefreshToken = await authStorage.getRefreshToken();
      if (!storedRefreshToken) {
        setUser(null);
        setPermissions([]);
        setStatus('anonymous');
        return null;
      }

      // Si no tenemos access token en memoria pero hay refresh token, renovar primero
      if (!authStorage.getAccessToken()) {
        await apiService.refreshToken(storedRefreshToken);
      }

      const userData = await apiService.getCurrentUser();
      setUser(userData);
      setPermissions(userData.permissions || []);
      setStatus('authenticated');
      return userData;
    } catch (err) {
      console.warn('[AuthProvider] No se pudo restaurar la sesión:', err);
      await authStorage.clearTokens();
      setUser(null);
      setPermissions([]);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => {
    // Restauración inicial de sesión al montar la app
    refreshSession();

    // Manejar evento de desautenticación emitido por el interceptor Axios
    const handleUnauthorized = () => {
      setUser(null);
      setPermissions([]);
      setStatus('anonymous');
    };

    window.addEventListener('gmao:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('gmao:unauthorized', handleUnauthorized);
    };
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string): Promise<CurrentUser> => {
    setStatus('loading');
    try {
      const loginRes = await apiService.login(username, password);
      setUser(loginRes.user);
      setPermissions(loginRes.user.permissions || []);
      setStatus('authenticated');
      return loginRes.user;
    } catch (err) {
      setUser(null);
      setPermissions([]);
      setStatus('anonymous');
      throw err;
    }
  }, []);

  const value: AuthContextValue = {
    user,
    permissions,
    status,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un <AuthProvider>');
  }
  return context;
}
