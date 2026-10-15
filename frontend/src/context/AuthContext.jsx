import { useCallback, useState } from 'react';
import * as authService from '../services/authService.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const u = await authService.login(credentials);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const register = useCallback(async (payload) => {
    return authService.register(payload);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
