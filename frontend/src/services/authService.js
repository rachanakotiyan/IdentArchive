/**
 * authService – mock authentication.
 * DEMO MODE ONLY. Never store real credentials.
 */
import { MOCK_USERS } from '../mock/users.js';
import { withLatency } from '../mock/latency.js';

const SESSION_KEY = 'ia-session';

function saveSession(user) {
  try {
    // Never save passwords to session
    const { password: _pw, ...safe } = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function login({ email, password: _password }) {
  return withLatency(() => {
    const user = MOCK_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === _password
    );
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    saveSession(user);
    const { password: _pw, ...safe } = user;
    return safe;
  });
}

export async function register({ name, email, password: _password, phone }) {
  return withLatency(() => {
    const existing = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }
    // In the mock, we don't actually persist; just return success
    return {
      userId: `usr-${Date.now()}`,
      name,
      email,
      phone,
      role: 'individual',
      verifiedAt: null,
    };
  });
}

export async function logout() {
  return withLatency(() => {
    clearSession();
    return true;
  });
}

export async function requestPasswordReset({ email: _email }) {
  return withLatency(() => {
    // Always return success so we don't leak whether an email exists
    return { sent: true };
  });
}

export async function resetPassword({ token, newPassword: _newPassword }) {
  return withLatency(() => {
    if (!token || token.length < 4) {
      throw new Error('Invalid or expired reset token.');
    }
    return { reset: true };
  });
}

export async function verifyEmail({ token }) {
  return withLatency(() => {
    if (!token || token.length < 4) {
      throw new Error('Invalid or expired verification token.');
    }
    return { verified: true };
  });
}
