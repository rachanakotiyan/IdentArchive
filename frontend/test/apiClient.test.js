import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  apiRequest,
  ApiError,
  getApiBaseUrl,
  setTokenProvider,
  setUnauthorizedHandler,
} from '../src/services/apiClient.js';

// Helper to mock global fetch for a test
function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    return handler(...args);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('ApiError: constructs error with status, code, details and data', () => {
  const err401 = new ApiError({ message: 'Unauthorized', status: 401 });
  assert.equal(err401.name, 'ApiError');
  assert.equal(err401.status, 401);
  assert.equal(err401.code, 'UNAUTHORIZED');
  assert.equal(err401.message, 'Unauthorized');
  assert.deepEqual(err401.details, []);
  assert.equal(err401.data, null);

  const err403 = new ApiError({ message: 'Forbidden', status: 403 });
  assert.equal(err403.code, 'FORBIDDEN');

  const err500 = new ApiError({ message: 'Server Error', status: 500 });
  assert.equal(err500.code, 'API_ERROR');

  const errCustom = new ApiError({
    message: 'Validation failed',
    status: 400,
    code: 'VALIDATION_ERROR',
    details: [{ field: 'email', message: 'Required' }],
    data: { custom: true },
  });
  assert.equal(errCustom.code, 'VALIDATION_ERROR');
  assert.deepEqual(errCustom.details, [{ field: 'email', message: 'Required' }]);
  assert.deepEqual(errCustom.data, { custom: true });
});

test('getApiBaseUrl: defaults to http://localhost:3000/api and normalizes trailing slashes', () => {
  const baseUrl = getApiBaseUrl();
  assert.equal(baseUrl, 'http://localhost:3000/api');
  assert.equal(baseUrl.endsWith('/'), false);
});

test('apiRequest: URL construction handles relative endpoints, leading slashes, and overrides', async () => {
  let capturedUrl = '';
  const restore = mockFetch(async (url) => {
    capturedUrl = url;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    await apiRequest('/health');
    assert.equal(capturedUrl, 'http://localhost:3000/api/health');

    await apiRequest('cases');
    assert.equal(capturedUrl, 'http://localhost:3000/api/cases');

    await apiRequest('/reports', { baseUrl: 'https://example.com/api/' });
    assert.equal(capturedUrl, 'https://example.com/api/reports');

    await apiRequest('https://external-service.org/v1/ping');
    assert.equal(capturedUrl, 'https://external-service.org/v1/ping');
  } finally {
    restore();
  }
});

test('apiRequest: sets JSON Content-Type and serializes body for objects', async () => {
  let capturedOptions = null;
  const restore = mockFetch(async (_url, opts) => {
    capturedOptions = opts;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    const payload = { title: 'Missing Person', age: 34 };
    await apiRequest('/reports', {
      method: 'POST',
      body: payload,
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(capturedOptions.body, JSON.stringify(payload));
  } finally {
    restore();
  }
});

test('apiRequest: preserves custom Content-Type and does not re-serialize raw strings', async () => {
  let capturedOptions = null;
  const restore = mockFetch(async (_url, opts) => {
    capturedOptions = opts;
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  });

  try {
    await apiRequest('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'a,b,c\n1,2,3',
    });

    assert.equal(capturedOptions.headers['Content-Type'], 'text/csv');
    assert.equal(capturedOptions.body, 'a,b,c\n1,2,3');
  } finally {
    restore();
  }
});

test('apiRequest: Bearer token is attached only when a non-empty string is provided', async () => {
  let capturedHeaders = {};
  const restore = mockFetch(async (_url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ data: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    // 1. No token provided
    setTokenProvider(null);
    await apiRequest('/test');
    assert.equal(capturedHeaders['Authorization'], undefined);

    // 2. Mock user object passed as token - must NEVER be attached
    await apiRequest('/test', { token: { userId: 'usr-001', role: 'admin' } });
    assert.equal(capturedHeaders['Authorization'], undefined);

    // 3. Empty or whitespace string
    await apiRequest('/test', { token: '   ' });
    assert.equal(capturedHeaders['Authorization'], undefined);

    // 4. Valid explicit token
    await apiRequest('/test', { token: 'my-jwt-token-123' });
    assert.equal(capturedHeaders['Authorization'], 'Bearer my-jwt-token-123');

    // 5. Dynamic token provider
    setTokenProvider(() => 'dynamic-session-token');
    await apiRequest('/test');
    assert.equal(capturedHeaders['Authorization'], 'Bearer dynamic-session-token');

    // 6. Explicit token overrides token provider
    await apiRequest('/test', { token: 'override-token' });
    assert.equal(capturedHeaders['Authorization'], 'Bearer override-token');
  } finally {
    setTokenProvider(null);
    restore();
  }
});

test('apiRequest: handles 204 No Content and non-JSON text responses', async () => {
  const restore204 = mockFetch(async () => {
    return new Response(null, { status: 204 });
  });

  try {
    const res204 = await apiRequest('/no-content');
    assert.equal(res204, null);
  } finally {
    restore204();
  }

  const restoreText = mockFetch(async () => {
    return new Response('Plain text response', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  });

  try {
    const resText = await apiRequest('/text-endpoint');
    assert.equal(resText, 'Plain text response');
  } finally {
    restoreText();
  }
});

test('apiRequest: extracts structured backend errors', async () => {
  const backendErrorPayload = {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input fields',
      details: [{ field: 'name', message: 'Name is required' }],
    },
  };

  const restore = mockFetch(async () => {
    return new Response(JSON.stringify(backendErrorPayload), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    await assert.rejects(
      async () => {
        await apiRequest('/validate');
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.message, 'Invalid input fields');
        assert.deepEqual(err.details, [{ field: 'name', message: 'Name is required' }]);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('apiRequest: distinguishes 401 from 403 and triggers unauthorized handler only on 401', async () => {
  let unauthorizedCalls = 0;
  let lastUnauthorizedError = null;

  setUnauthorizedHandler((err) => {
    unauthorizedCalls += 1;
    lastUnauthorizedError = err;
  });

  // Test 401 Unauthorized
  const restore401 = mockFetch(async () => {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired.' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  });

  try {
    await assert.rejects(async () => {
      await apiRequest('/protected');
    }, ApiError);

    assert.equal(unauthorizedCalls, 1);
    assert.equal(lastUnauthorizedError.status, 401);
    assert.equal(lastUnauthorizedError.code, 'TOKEN_EXPIRED');
  } finally {
    restore401();
  }

  // Test 403 Forbidden - MUST NOT trigger unauthorizedHandler
  const restore403 = mockFetch(async () => {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  });

  try {
    await assert.rejects(
      async () => {
        await apiRequest('/admin/only');
      },
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );

    // Call count must remain 1 (403 must never invoke unauthorizedHandler)
    assert.equal(unauthorizedCalls, 1);
  } finally {
    restore403();
    setUnauthorizedHandler(null);
  }
});

test('apiClient convenience methods (get, post, put, patch, delete)', async () => {
  const methodHistory = [];
  const restore = mockFetch(async (url, opts) => {
    methodHistory.push({ url, method: opts.method, body: opts.body });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    await apiClient.get('/cases');
    await apiClient.post('/cases', { title: 'Case 1' });
    await apiClient.put('/cases/1', { title: 'Case 1 updated' });
    await apiClient.patch('/cases/1', { status: 'closed' });
    await apiClient.delete('/cases/1');

    assert.equal(methodHistory.length, 5);
    assert.equal(methodHistory[0].method, 'GET');
    assert.equal(methodHistory[1].method, 'POST');
    assert.equal(methodHistory[2].method, 'PUT');
    assert.equal(methodHistory[3].method, 'PATCH');
    assert.equal(methodHistory[4].method, 'DELETE');
  } finally {
    restore();
  }
});
