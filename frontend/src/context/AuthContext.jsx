import { useCallback, useEffect, useRef, useState } from 'react';
import * as authService from '../services/authService.js';
import { AuthContext } from './authContext.js';

/**
 * AuthProvider
 *
 * Manages the authenticated user state for the application.
 *
 * On mount it calls GET /api/auth/me (via authService.fetchCurrentUser()) to
 * validate any token persisted from a previous session and hydrate the user
 * profile from the server.  Until that call resolves, `loadingSession` is true
 * so layouts can show a skeleton instead of a login redirect.
 *
 * Token lifecycle is fully managed inside authService (and apiClient):
 *  - login/register  → token written to sessionStorage + apiClient
 *  - logout          → token cleared from sessionStorage + apiClient
 *  - page refresh    → authService module-init restores token from sessionStorage
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  // Track whether we've already attempted the initial session refresh.
  const sessionChecked = useRef(false);

  // -------------------------------------------------------------------------
  // On mount: validate persisted token with GET /api/auth/me
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (sessionChecked.current) return;
    sessionChecked.current = true;

    const token = authService.getStoredToken();

    if (!token) {
      // No stored token → skip the network call
      setUser(null);
      setLoadingSession(false);
      return;
    }

    authService
      .fetchCurrentUser()
      .then((freshUser) => {
        setUser(freshUser);
      })
      .catch(() => {
        // Token invalid/expired – clear stale session quietly
        authService.logout();
        setUser(null);
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Authenticate a user. Syncs the received JWT into apiClient automatically
   * (handled by authService.login).
   *
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<object>} User profile object
   */
  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const { user: u } = await authService.login(credentials);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign the current user out and clear context state.
   */
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Register a new individual user account.
   * On success the token is persisted and the user is signed in automatically.
   *
   * @param {{ name: string, email: string, password: string, phone?: string }} payload
   * @returns {Promise<object>} User profile object
   */
  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { user: u } = await authService.register(payload);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Re-fetch the current user profile from GET /api/auth/me and update context.
   * Useful after profile updates.
   *
   * @returns {Promise<object>} Latest user profile
   */
  const refreshUser = useCallback(async () => {
    const freshUser = await authService.fetchCurrentUser();
    setUser(freshUser);
    return freshUser;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, loadingSession, login, logout, register, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
