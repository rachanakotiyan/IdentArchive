/**
 * authService tests
 *
 * All tests run in Node.js (no browser / React context).
 * We stub:
 *  - globalThis.sessionStorage  (key-value Map backed)
 *  - globalThis.fetch           (via mockFetch helper)
 *
 * We import authService functions directly and verify:
 *  - login()  → POST /api/auth/login → token written to storage + apiClient
 *  - register() → POST /api/auth/register → same
 *  - logout() → clears storage + apiClient token
 *  - fetchCurrentUser() → GET /api/auth/me → returns user, refreshes cache
 *  - getCurrentUser() → reads from sessionStorage without network call
 *  - getStoredToken() → returns stored JWT
 *  - token session persistence across module state
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Browser storage mock (set up before module import so the module-init code
// that reads sessionStorage for token restoration sees our stub).
// ---------------------------------------------------------------------------
function createMockStorage() {
  const store = new Map();
  return {
    getItem:    (k) => store.get(k) ?? null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    _store:     store,
  };
}

let mockSessionStorage = createMockStorage();
globalThis.sessionStorage = mockSessionStorage;
// Note: localStorage is not used by authService; sessionStorage only.

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------
function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (...args) => handler(...args);
  return () => { globalThis.fetch = original; };
}

function makeResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Import after stubs are in place
// ---------------------------------------------------------------------------
import {
  login,
  logout,
  register,
  fetchCurrentUser,
  getCurrentUser,
  getStoredToken,
  getStoredSession,
  requestPasswordReset,
} from '../src/services/authService.js';

import apiClient from '../src/services/apiClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetStorage() {
  mockSessionStorage._store.clear();
  apiClient.setToken(null);
}

const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1c3ItMDAxIn0.FAKE';

const MOCK_USER = {
  user_id: 'usr-001',
  name:  'Priya Sharma',
  email: 'priya@test.local',
  role:  'individual',
  phone: '9876543210',
};

// Typical backend success response for login/register
function loginResponse(user = MOCK_USER, token = FAKE_TOKEN) {
  return { success: true, data: { token, user } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('login: POSTs to /api/auth/login, writes token to sessionStorage, injects into apiClient', async () => {
  resetStorage();

  let capturedUrl = '';
  let capturedBody = null;

  const restore = mockFetch(async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return makeResponse(loginResponse());
  });

  try {
    const result = await login({ email: 'priya@test.local', password: 'secret' });

    // Return shape
    assert.ok(result.user);
    assert.ok(result.token);
    assert.equal(result.token, FAKE_TOKEN);
    assert.equal(result.user.name, 'Priya Sharma');

    // URL
    assert.match(capturedUrl, /\/api\/auth\/login$/);

    // Request body
    assert.equal(capturedBody.email, 'priya@test.local');
    assert.equal(capturedBody.password, 'secret');

    // sessionStorage
    assert.equal(getStoredToken(), FAKE_TOKEN);
    assert.ok(getCurrentUser());
    assert.equal(getCurrentUser().name, 'Priya Sharma');

    // apiClient.getToken() confirms injection
    assert.equal(apiClient.getToken(), FAKE_TOKEN);

    // Password must never be persisted
    assert.equal('password' in getCurrentUser(), false);
    assert.equal('password_hash' in getCurrentUser(), false);
  } finally {
    restore();
    resetStorage();
  }
});

test('login: trims whitespace from email before sending', async () => {
  resetStorage();

  let capturedEmail = '';
  const restore = mockFetch(async (_url, opts) => {
    capturedEmail = JSON.parse(opts.body).email;
    return makeResponse(loginResponse());
  });

  try {
    await login({ email: '  priya@test.local  ', password: 'secret' });
    assert.equal(capturedEmail, 'priya@test.local');
  } finally {
    restore();
    resetStorage();
  }
});

test('login: throws ApiError on 401 and does not write session', async () => {
  resetStorage();

  const restore = mockFetch(async () =>
    makeResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials.' } }, 401)
  );

  try {
    await assert.rejects(
      () => login({ email: 'bad@test.local', password: 'wrong' }),
      (err) => {
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );

    // Session must remain empty
    assert.equal(getStoredToken(), null);
    assert.equal(getCurrentUser(), null);
    assert.equal(apiClient.getToken(), null);
  } finally {
    restore();
    resetStorage();
  }
});

test('register: POSTs to /api/auth/register, persists token, signs in automatically', async () => {
  resetStorage();

  let capturedUrl = '';
  let capturedBody = null;
  const newUser = { ...MOCK_USER, name: 'New User', email: 'newuser@test.local' };

  const restore = mockFetch(async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return makeResponse(loginResponse(newUser, 'register-token-xyz'));
  });

  try {
    const result = await register({
      name: 'New User',
      email: 'newuser@test.local',
      password: 'password123',
      phone: '9000000000',
    });

    assert.match(capturedUrl, /\/api\/auth\/register$/);
    assert.equal(capturedBody.name, 'New User');
    assert.equal(capturedBody.email, 'newuser@test.local');
    assert.ok(!('password_hash' in capturedBody));

    assert.equal(result.token, 'register-token-xyz');
    assert.equal(result.user.email, 'newuser@test.local');

    // Persisted in storage
    assert.equal(getStoredToken(), 'register-token-xyz');
    assert.equal(getCurrentUser()?.name, 'New User');
    assert.equal(apiClient.getToken(), 'register-token-xyz');
  } finally {
    restore();
    resetStorage();
  }
});

test('logout: clears sessionStorage and removes apiClient token', async () => {
  resetStorage();

  // Simulate being logged in
  mockSessionStorage.setItem('ia-token', FAKE_TOKEN);
  mockSessionStorage.setItem('ia-session', JSON.stringify(MOCK_USER));
  apiClient.setToken(FAKE_TOKEN);

  assert.equal(getStoredToken(), FAKE_TOKEN);
  assert.ok(getCurrentUser());

  await logout();

  assert.equal(getStoredToken(), null);
  assert.equal(getCurrentUser(), null);
  assert.equal(apiClient.getToken(), null);
});

test('fetchCurrentUser: GETs /api/auth/me with Bearer token and refreshes session cache', async () => {
  resetStorage();

  // Start with a token in storage
  mockSessionStorage.setItem('ia-token', FAKE_TOKEN);
  apiClient.setToken(FAKE_TOKEN);

  let capturedAuth = null;
  const updatedUser = { ...MOCK_USER, name: 'Priya Sharma (updated)' };

  const restore = mockFetch(async (url, opts) => {
    capturedAuth = opts.headers?.['Authorization'];
    return makeResponse({ success: true, data: updatedUser });
  });

  try {
    const user = await fetchCurrentUser();

    // Sends Bearer token
    assert.equal(capturedAuth, `Bearer ${FAKE_TOKEN}`);

    // Returns updated profile
    assert.equal(user.name, 'Priya Sharma (updated)');

    // Refreshes session cache
    assert.equal(getCurrentUser()?.name, 'Priya Sharma (updated)');
  } finally {
    restore();
    resetStorage();
  }
});

test('fetchCurrentUser: throws ApiError on 401 (expired token)', async () => {
  resetStorage();
  mockSessionStorage.setItem('ia-token', 'expired-token');
  apiClient.setToken('expired-token');

  const restore = mockFetch(async () =>
    makeResponse({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Token has expired.' } }, 401)
  );

  try {
    await assert.rejects(
      () => fetchCurrentUser(),
      (err) => {
        assert.equal(err.status, 401);
        return true;
      }
    );
  } finally {
    restore();
    resetStorage();
  }
});

test('getCurrentUser: returns parsed user profile from sessionStorage without network call', () => {
  resetStorage();
  assert.equal(getCurrentUser(), null);

  mockSessionStorage.setItem('ia-session', JSON.stringify(MOCK_USER));
  const user = getCurrentUser();
  assert.ok(user);
  assert.equal(user.name, 'Priya Sharma');
  assert.equal(user.email, 'priya@test.local');

  resetStorage();
});

test('getStoredToken: returns token from sessionStorage', () => {
  resetStorage();
  assert.equal(getStoredToken(), null);

  mockSessionStorage.setItem('ia-token', FAKE_TOKEN);
  assert.equal(getStoredToken(), FAKE_TOKEN);

  resetStorage();
});

test('getStoredSession: returns both user and token without network call', () => {
  resetStorage();
  mockSessionStorage.setItem('ia-token', FAKE_TOKEN);
  mockSessionStorage.setItem('ia-session', JSON.stringify(MOCK_USER));

  const session = getStoredSession();
  assert.equal(session.token, FAKE_TOKEN);
  assert.equal(session.user?.name, 'Priya Sharma');

  resetStorage();
});

test('token session persistence: token restored across service calls', async () => {
  resetStorage();

  // Simulate a persisted token from a previous page load
  mockSessionStorage.setItem('ia-token', FAKE_TOKEN);

  // apiClient.getToken() reads via the sessionStorage fallback (set up in apiClient)
  // The token provider is wired by authService on module init.
  const token = apiClient.getToken();
  assert.equal(token, FAKE_TOKEN);

  // A subsequent authenticated request should carry the token
  let capturedAuth = null;
  const restore = mockFetch(async (_url, opts) => {
    capturedAuth = opts.headers?.['Authorization'];
    return makeResponse({ success: true, data: MOCK_USER });
  });

  try {
    await fetchCurrentUser();
    assert.equal(capturedAuth, `Bearer ${FAKE_TOKEN}`);
  } finally {
    restore();
    resetStorage();
  }
});

test('requestPasswordReset: always returns { sent: true } regardless of backend error', async () => {
  resetStorage();

  // Simulate backend 404
  const restore = mockFetch(async () =>
    makeResponse({ success: false, error: { code: 'NOT_FOUND', message: 'No account.' } }, 404)
  );

  try {
    const result = await requestPasswordReset({ email: 'noone@test.local' });
    assert.deepEqual(result, { sent: true });
  } finally {
    restore();
    resetStorage();
  }
});

test('login: throws INVALID_RESPONSE error when backend returns no token', async () => {
  resetStorage();

  const restore = mockFetch(async () =>
    makeResponse({ success: true, data: { user: MOCK_USER } })  // token missing
  );

  try {
    await assert.rejects(
      () => login({ email: 'priya@test.local', password: 'secret' }),
      (err) => {
        assert.equal(err.code, 'INVALID_RESPONSE');
        assert.equal(err.status, 500);
        return true;
      }
    );

    // No session written
    assert.equal(getStoredToken(), null);
    assert.equal(apiClient.getToken(), null);
  } finally {
    restore();
    resetStorage();
  }
});
