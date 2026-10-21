/**
 * Frontend API client utility wrapping native fetch.
 *
 * Configured with base URL from VITE_API_BASE_URL (defaults to http://localhost:3000/api).
 * Features:
 *  - Automatic Bearer token header injection (via in-memory token, dynamic provider, or session/local storage fallback).
 *  - Interceptor architecture for both requests and responses/errors.
 *  - Unified error transformation to structured ApiError (handling backend { error: { code, message, details } } convention).
 *  - Distinguishes 401 Unauthorized from 403 Forbidden with dedicated unauthorized hook.
 *  - Normalizes network failures (status 0, NETWORK_ERROR).
 *  - Axios-compatible convenience methods (get, post, put, patch, delete) and callable apiClient function.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000/api';

/**
 * Custom error class representing API failures with structured backend error details.
 */
export class ApiError extends Error {
  /**
   * @param {object} params
   * @param {string} params.message - Human-readable error message
   * @param {number} params.status - HTTP status code (0 for network errors)
   * @param {string} [params.code] - Machine-readable error code (e.g. UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR)
   * @param {Array} [params.details] - Field-level validation or error details
   * @param {*} [params.data] - Raw error response data
   */
  constructor({ message, status, code, details = [], data = null }) {
    super(message || (status === 0 ? 'Network error' : `API request failed with status ${status}`));
    this.name = 'ApiError';
    this.status = status;
    this.code =
      code ||
      (status === 0
        ? 'NETWORK_ERROR'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : 'API_ERROR');
    this.details = details;
    this.data = data;
  }
}

/**
 * Interceptor manager supporting registration, ejection, and clearing of interceptor hooks.
 */
export class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  /**
   * Register a new interceptor handler.
   *
   * @param {Function} [fulfilled]
   * @param {Function} [rejected]
   * @returns {number} ID for ejection
   */
  use(fulfilled, rejected) {
    this.handlers.push({
      fulfilled: typeof fulfilled === 'function' ? fulfilled : null,
      rejected: typeof rejected === 'function' ? rejected : null,
    });
    return this.handlers.length - 1;
  }

  /**
   * Remove an interceptor by its registered ID.
   *
   * @param {number} id
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Remove all registered interceptors.
   */
  clear() {
    this.handlers = [];
  }
}

/**
 * Resolves the API base URL from Vite environment, Node environment, or local development default.
 * Strips any trailing slashes for consistent URL joining.
 *
 * @returns {string} Normalized base URL
 */
export function getApiBaseUrl() {
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL;
  const processEnv = typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL;
  const rawUrl = viteEnv || processEnv || DEFAULT_BASE_URL;
  return String(rawUrl).trim().replace(/\/+$/, '');
}

let inMemoryToken = null;
let tokenProvider = null;
let unauthorizedHandler = null;

// Global interceptors for the default client
export const requestInterceptors = new InterceptorManager();
export const responseInterceptors = new InterceptorManager();

/**
 * Configure an explicit in-memory authentication token.
 *
 * @param {string | null} token
 */
export function setAuthToken(token) {
  inMemoryToken = typeof token === 'string' && token.trim() ? token.trim() : null;
}

/**
 * Retrieve the current active authentication token.
 * Checks in-memory token, dynamic token provider, and safe storage fallback.
 *
 * @returns {string | null}
 */
export function getAuthToken() {
  if (typeof inMemoryToken === 'string' && inMemoryToken.trim()) {
    return inMemoryToken.trim();
  }

  if (typeof tokenProvider === 'function') {
    try {
      const provided = tokenProvider();
      if (typeof provided === 'string' && provided.trim()) {
        return provided.trim();
      }
    } catch {
      // ignore provider errors
    }
  }

  // Safe browser storage fallback
  const storageKeys = ['ia-token', 'token', 'authToken', 'jwt'];

  if (typeof sessionStorage !== 'undefined') {
    try {
      for (const key of storageKeys) {
        const val = sessionStorage.getItem(key);
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch {
      // ignore storage access errors
    }
  }

  if (typeof localStorage !== 'undefined') {
    try {
      for (const key of storageKeys) {
        const val = localStorage.getItem(key);
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch {
      // ignore storage access errors
    }
  }

  return null;
}

/**
 * Configure a dynamic token getter function.
 *
 * @param {(() => string | null) | null} provider
 */
export function setTokenProvider(provider) {
  tokenProvider = typeof provider === 'function' ? provider : null;
}

/**
 * Configure a handler for HTTP 401 Unauthorized responses.
 * Note: Never triggered for HTTP 403 Forbidden.
 *
 * @param {((error: ApiError) => void) | null} handler
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

/**
 * Automatic Bearer Token Header Injection Interceptor.
 * Attached by default to ensure all outgoing requests carry the active token.
 */
function defaultAuthRequestInterceptor(config) {
  const headers = { ...config.headers };

  // Explicit token passed in options takes priority
  let activeToken = null;
  if (config.token !== undefined) {
    if (typeof config.token === 'string' && config.token.trim()) {
      activeToken = config.token.trim();
    }
  } else {
    activeToken = getAuthToken();
  }

  if (typeof activeToken === 'string' && activeToken.trim()) {
    if (!headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${activeToken.trim()}`;
    }
  }

  return {
    ...config,
    headers,
  };
}

// Register default auth request interceptor
requestInterceptors.use(defaultAuthRequestInterceptor);

/**
 * Core unified request helper wrapping native fetch with interceptor pipeline.
 *
 * @param {string} endpoint - API endpoint path (e.g. '/health' or full URL)
 * @param {object} [options={}] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {*} [options.body] - Request body (objects will be JSON-serialized)
 * @param {object} [options.headers] - Additional HTTP headers
 * @param {string} [options.token] - Explicit Bearer token override
 * @param {string} [options.baseUrl] - Base URL override
 * @returns {Promise<*>} Parsed response data
 */
export async function apiRequest(endpoint, options = {}) {
  let config = {
    endpoint,
    method: 'GET',
    headers: {},
    baseUrl: getApiBaseUrl(),
    ...options,
  };

  // Run Request Interceptor Chain
  for (const handler of requestInterceptors.handlers) {
    if (handler && handler.fulfilled) {
      try {
        config = await handler.fulfilled(config);
      } catch (err) {
        if (handler.rejected) {
          config = await handler.rejected(err);
        } else {
          throw err;
        }
      }
    }
  }

  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    token: _explicitToken,
    baseUrl = getApiBaseUrl(),
    endpoint: resolvedEndpoint,
    ...fetchOptions
  } = config;

  const targetEndpoint = resolvedEndpoint || endpoint;
  const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  const url =
    targetEndpoint.startsWith('http://') || targetEndpoint.startsWith('https://')
      ? targetEndpoint
      : `${cleanBaseUrl}/${targetEndpoint.replace(/^\/+/, '')}`;

  const headers = { ...customHeaders };

  // Set default JSON Content-Type if sending a body and not already specified
  if (body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  let serializedBody = body;
  if (
    body !== undefined &&
    typeof body !== 'string' &&
    !(typeof FormData !== 'undefined' && body instanceof FormData) &&
    !(typeof Blob !== 'undefined' && body instanceof Blob) &&
    !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
  ) {
    serializedBody = JSON.stringify(body);
  }

  let rawResponse;
  try {
    rawResponse = await fetch(url, {
      method,
      headers,
      body: serializedBody,
      ...fetchOptions,
    });
  } catch (networkError) {
    // Transform fetch network errors into structured ApiError with status 0
    const unifiedError = new ApiError({
      message: networkError?.message || 'Network error: Failed to communicate with server',
      status: 0,
      code: 'NETWORK_ERROR',
      data: null,
    });

    // Run error through Response Interceptor Chain (rejection handlers)
    let processedError = unifiedError;
    for (const handler of responseInterceptors.handlers) {
      if (handler && handler.rejected) {
        try {
          processedError = await handler.rejected(processedError);
        } catch (chainErr) {
          processedError = chainErr;
        }
      }
    }

    throw processedError;
  }

  // Handle 204 No Content
  if (rawResponse.status === 204) {
    return null;
  }

  const contentType = rawResponse.headers.get('content-type') || '';
  let responseData = null;

  if (contentType.includes('application/json')) {
    try {
      responseData = await rawResponse.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await rawResponse.text();
    } catch {
      responseData = null;
    }
  }

  if (!rawResponse.ok) {
    // Extract structured error format from IdentArchive backend: { success: false, error: { code, message, details } }
    const errorPayload =
      responseData && typeof responseData === 'object'
        ? responseData.error || responseData
        : null;
    const message =
      errorPayload?.message ||
      (typeof responseData === 'string' && responseData.trim()
        ? responseData
        : `Request failed with status ${rawResponse.status}`);
    const code = errorPayload?.code;
    const details = errorPayload?.details || [];

    let apiError = new ApiError({
      message,
      status: rawResponse.status,
      code,
      details,
      data: responseData,
    });

    // Invoke unauthorized callback only on 401 Unauthorized, never on 403 Forbidden
    if (rawResponse.status === 401 && unauthorizedHandler) {
      try {
        unauthorizedHandler(apiError);
      } catch {
        // Do not let handler errors mask the original ApiError
      }
    }

    // Run through Response Interceptor Chain (rejection handlers)
    for (const handler of responseInterceptors.handlers) {
      if (handler && handler.rejected) {
        try {
          apiError = await handler.rejected(apiError);
        } catch (chainErr) {
          apiError = chainErr;
        }
      }
    }

    throw apiError;
  }

  // Run through Response Interceptor Chain (fulfillment handlers)
  let processedData = responseData;
  for (const handler of responseInterceptors.handlers) {
    if (handler && handler.fulfilled) {
      try {
        processedData = await handler.fulfilled(processedData);
      } catch (chainErr) {
        throw chainErr;
      }
    }
  }

  return processedData;
}

/**
 * Callable apiClient instance with Axios-style convenience methods.
 */
function createApiClientInstance() {
  const client = (endpoint, options) => apiRequest(endpoint, options);

  client.get = (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' });
  client.post = (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'POST', body });
  client.put = (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PUT', body });
  client.patch = (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PATCH', body });
  client.delete = (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' });

  client.request = apiRequest;
  client.setToken = setAuthToken;
  client.getToken = getAuthToken;
  client.setTokenProvider = setTokenProvider;
  client.setUnauthorizedHandler = setUnauthorizedHandler;
  client.getApiBaseUrl = getApiBaseUrl;

  client.interceptors = {
    request: requestInterceptors,
    response: responseInterceptors,
  };

  client.ApiError = ApiError;

  return client;
}

export const apiClient = createApiClientInstance();

export default apiClient;
