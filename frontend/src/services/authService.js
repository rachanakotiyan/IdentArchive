/**
 * authService – live backend authentication.
 *
 * All calls target the IdentArchive Express API:
 *   POST /api/auth/register   → create individual account
 *   POST /api/auth/login      → authenticate, receive JWT
 *   GET  /api/auth/me         → verify token + fetch fresh profile
 *
 * Token lifecycle:
 *  - On login/register: JWT is written to sessionStorage('ia-token') and
 *    injected into apiClient via setAuthToken() so all subsequent requests
 *    carry it automatically.
 *  - On logout: storage is cleared, apiClient token is removed.
 *  - On cold start (page refresh): the token is read back from sessionStorage
 *    by apiClient.getAuthToken() without any extra wiring.
 *
 * getCurrentUser() reads the last-fetched user profile from sessionStorage.
 * AuthContext calls refreshUser() (GET /api/auth/me) on mount to validate
 * the persisted token and obtain the latest server-side profile.
 */

import apiClient, { ApiError, setTokenProvider } from './apiClient.js';

const SESSION_KEY = 'ia-session';
const TOKEN_KEY   = 'ia-token';

// ---------------------------------------------------------------------------
// Storage helpers (sessionStorage, safe in SSR / Node test environments)
// ---------------------------------------------------------------------------

function safeGet(key) {
  try {
    return typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function safeRemove(key) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function writeSession(token, user) {
  safeSet(TOKEN_KEY, token);
  // Never persist password-related fields
  const { password: _pw, password_hash: _ph, ...safe } = user;
  safeSet(SESSION_KEY, JSON.stringify(safe));
  // Inject into apiClient immediately so next requests carry the token
  apiClient.setToken(token);
}

function clearSession() {
  safeRemove(TOKEN_KEY);
  safeRemove(SESSION_KEY);
  apiClient.setToken(null);
}

// ---------------------------------------------------------------------------
// On module load: restore token from sessionStorage into apiClient if present.
// This wires up the token provider so any request issued before login()
// resolves can still carry a persisted token (e.g. refreshUser on mount).
// ---------------------------------------------------------------------------
const _restoredToken = safeGet(TOKEN_KEY);
if (_restoredToken) {
  apiClient.setToken(_restoredToken);
}

// Also expose as a dynamic token provider so the fallback chain works.
setTokenProvider(() => safeGet(TOKEN_KEY));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the current user profile from sessionStorage without a network call.
 * Returns null if no session exists or if it cannot be parsed.
 *
 * @returns {object | null}
 */
export function getCurrentUser() {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Retrieve the currently persisted JWT token.
 *
 * @returns {string | null}
 */
export function getStoredToken() {
  return safeGet(TOKEN_KEY);
}

/**
 * Retrieve the current session (user + token) without a network call.
 *
 * @returns {{ user: object | null, token: string | null }}
 */
export function getStoredSession() {
  return {
    user: getCurrentUser(),
    token: getStoredToken(),
  };
}

/**
 * Register a new individual user account.
 *
 * On success the JWT is persisted and injected into apiClient.
 *
 * @param {{ name: string, email: string, password: string, phone?: string }} payload
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {ApiError}
 */
export async function register({ name, email, password, phone }) {
  const response = await apiClient.post('/auth/register', {
    name: name?.trim(),
    email: email?.trim(),
    password,
    ...(phone ? { phone: phone.trim() } : {}),
  });

  const { token, data } = extractTokenAndUser(response);
  writeSession(token, data);
  return { user: data, token };
}

/**
 * Authenticate a user with email and password.
 *
 * On success the JWT is persisted and injected into apiClient.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {ApiError}
 */
export async function login({ email, password }) {
  const response = await apiClient.post('/auth/login', {
    email: email?.trim(),
    password,
  });

  const { token, data } = extractTokenAndUser(response);
  writeSession(token, data);
  return { user: data, token };
}

/**
 * Verify the current token with the backend and return the latest user profile.
 * Call this on application mount to validate a persisted session.
 *
 * @returns {Promise<object>} User profile from the server
 * @throws {ApiError} e.g. 401 if the token is expired or invalid
 */
export async function fetchCurrentUser() {
  const response = await apiClient.get('/auth/me');

  // Backend returns: { success: true, data: { user_id, name, email, role, ... } }
  const user = response?.data ?? response;

  // Refresh the session profile cache without changing the stored token
  if (user && typeof user === 'object') {
    const { password: _pw, password_hash: _ph, ...safe } = user;
    safeSet(SESSION_KEY, JSON.stringify(safe));
  }

  return user;
}

/**
 * Sign the current user out.
 * Clears session storage and removes the token from apiClient.
 *
 * @returns {Promise<void>}
 */
export async function logout() {
  // Fire-and-forget: backend may have a logout endpoint in future
  clearSession();
}

/**
 * Send a password-reset email.
 *
 * @param {{ email: string }} param0
 * @returns {Promise<{ sent: boolean }>}
 */
export async function requestPasswordReset({ email }) {
  try {
    await apiClient.post('/auth/forgot-password', { email: email?.trim() });
  } catch {
    // Always return success so we don't reveal whether an account exists
  }
  return { sent: true };
}

/**
 * Submit a new password using a reset token.
 *
 * @param {{ token: string, newPassword: string }} param0
 * @returns {Promise<{ reset: boolean }>}
 */
export async function resetPassword({ token, newPassword }) {
  if (!token || token.length < 4) {
    throw new ApiError({ message: 'Invalid or expired reset token.', status: 400, code: 'VALIDATION_ERROR' });
  }
  await apiClient.post('/auth/reset-password', { token, password: newPassword });
  return { reset: true };
}

/**
 * Verify an email address with a token sent by the backend.
 *
 * @param {{ token: string }} param0
 * @returns {Promise<{ verified: boolean }>}
 */
export async function verifyEmail({ token }) {
  if (!token || token.length < 4) {
    throw new ApiError({ message: 'Invalid or expired verification token.', status: 400, code: 'VALIDATION_ERROR' });
  }
  await apiClient.post('/auth/verify-email', { token });
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Normalise the different response shapes the backend may return and extract
 * a token + user profile object.
 *
 * Backend shapes:
 *   { success: true, data: { token, user } }
 *   { success: true, data: { token, name, email, role, ... } }
 *   { token, user }           (less common, defensive)
 */
function extractTokenAndUser(response) {
  // Unwrap { data: ... } envelope
  const payload = response?.data ?? response;

  let token = payload?.token ?? null;
  // Validate token is a non-empty string
  if (typeof token !== 'string' || !token.trim()) {
    throw new ApiError({
      message: 'Server response did not include a valid authentication token.',
      status: 500,
      code: 'INVALID_RESPONSE',
      data: response,
    });
  }
  token = token.trim();

  // User profile may be nested under payload.user or inline in payload
  const data = (payload?.user && typeof payload.user === 'object')
    ? payload.user
    : payload;

  if (!data || typeof data !== 'object') {
    throw new ApiError({
      message: 'Server response did not include a valid user profile.',
      status: 500,
      code: 'INVALID_RESPONSE',
      data: response,
    });
  }

  return { token, data };
}
