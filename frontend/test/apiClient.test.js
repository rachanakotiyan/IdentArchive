import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  apiRequest,
  ApiError,
  InterceptorManager,
  getApiBaseUrl,
  getAuthToken,
  setAuthToken,
  setTokenProvider,
  setUnauthorizedHandler,
  requestInterceptors,
  responseInterceptors,
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

test('apiClient: direct callable instance invocation', async () => {
  let capturedUrl = '';
  const restore = mockFetch(async (url) => {
    capturedUrl = url;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    const res = await apiClient('/direct-endpoint');
    assert.equal(capturedUrl, 'http://localhost:3000/api/direct-endpoint');
    assert.deepEqual(res, { ok: true });
  } finally {
    restore();
  }
});

test('apiClient: setToken and getToken manage in-memory Bearer token injection', async () => {
  let capturedHeaders = {};
  const restore = mockFetch(async (_url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    apiClient.setToken('in-memory-token-abc');
    assert.equal(apiClient.getToken(), 'in-memory-token-abc');

    await apiClient.get('/cases');
    assert.equal(capturedHeaders['Authorization'], 'Bearer in-memory-token-abc');

    // Clearing token removes Authorization header
    apiClient.setToken(null);
    assert.equal(apiClient.getToken(), null);

    await apiClient.get('/cases');
    assert.equal(capturedHeaders['Authorization'], undefined);
  } finally {
    apiClient.setToken(null);
    restore();
  }
});

test('apiClient: automatic token fallback to localStorage and sessionStorage', async () => {
  let capturedHeaders = {};
  const restore = mockFetch(async (_url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  // Mock global storage
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
  };

  try {
    mockStorage.set('ia-token', 'stored-local-jwt');
    assert.equal(getAuthToken(), 'stored-local-jwt');

    await apiClient.get('/profile');
    assert.equal(capturedHeaders['Authorization'], 'Bearer stored-local-jwt');
  } finally {
    delete globalThis.localStorage;
    restore();
  }
});

test('InterceptorManager: request interceptor transforms configuration', async () => {
  let capturedHeaders = {};
  const restore = mockFetch(async (_url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const interceptorId = apiClient.interceptors.request.use((config) => {
    config.headers['X-Custom-Client'] = 'IdentArchive-Web';
    return config;
  });

  try {
    await apiClient.get('/ping');
    assert.equal(capturedHeaders['X-Custom-Client'], 'IdentArchive-Web');
  } finally {
    apiClient.interceptors.request.eject(interceptorId);
    restore();
  }

  // Verify ejected interceptor no longer runs
  const restore2 = mockFetch(async (_url, opts) => {
    capturedHeaders = opts.headers;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  try {
    await apiClient.get('/ping');
    assert.equal(capturedHeaders['X-Custom-Client'], undefined);
  } finally {
    restore2();
  }
});

test('InterceptorManager: response interceptor transforms payload', async () => {
  const restore = mockFetch(async () => {
    return new Response(JSON.stringify({ data: { id: 1, name: 'Alice' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  // Unwraps { data: ... }
  const interceptorId = apiClient.interceptors.response.use((response) => {
    return response.data;
  });

  try {
    const result = await apiClient.get('/user');
    assert.deepEqual(result, { id: 1, name: 'Alice' });
  } finally {
    apiClient.interceptors.response.eject(interceptorId);
    restore();
  }
});

test('unified error interceptor: converts network failure into ApiError with status 0 and NETWORK_ERROR', async () => {
  const restore = mockFetch(async () => {
    throw new TypeError('Failed to fetch: Connection refused');
  });

  try {
    await assert.rejects(
      async () => {
        await apiClient.get('/cases');
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 0);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.match(err.message, /Failed to fetch/);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('unified error interceptor: allows custom response error interceptor to handle or rethrow', async () => {
  const restore = mockFetch(async () => {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Item does not exist' },
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  });

  let interceptedError = null;
  const interceptorId = apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
      interceptedError = err;
      throw err;
    }
  );

  try {
    await assert.rejects(async () => {
      await apiClient.get('/missing-item');
    }, ApiError);

    assert.ok(interceptedError);
    assert.equal(interceptedError.status, 404);
    assert.equal(interceptedError.code, 'NOT_FOUND');
    assert.equal(interceptedError.message, 'Item does not exist');
  } finally {
    apiClient.interceptors.response.eject(interceptorId);
    restore();
  }
});

