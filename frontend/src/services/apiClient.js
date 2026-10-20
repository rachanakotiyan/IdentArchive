/**
 * Frontend API client utility wrapping native fetch.
 *
 * Configured with base URL from VITE_API_BASE_URL (defaults to http://localhost:3000/api).
 * Handles JSON request/response bodies, structured backend error conventions,
 * and optional Bearer token authentication.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000/api';

/**
 * Custom error class representing API failures with structured backend error details.
 */
export class ApiError extends Error {
  /**
   * @param {object} params
   * @param {string} params.message - Human-readable error message
   * @param {number} params.status - HTTP status code
   * @param {string} [params.code] - Machine-readable error code (e.g. UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR)
   * @param {Array} [params.details] - Field-level validation or error details
   * @param {*} [params.data] - Raw error response data
   */
  constructor({ message, status, code, details = [], data = null }) {
    super(message || `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'API_ERROR');
    this.details = details;
    this.data = data;
  }
}

/**
 * Resolves the API base URL from Vite environment or falls back to local development default.
 * Strips any trailing slashes for consistent URL joining.
 *
 * @returns {string} Normalized base URL
 */
export function getApiBaseUrl() {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL;
  const rawUrl = typeof envUrl === 'string' && envUrl.trim() ? envUrl.trim() : DEFAULT_BASE_URL;
  return rawUrl.replace(/\/+$/, '');
}

let tokenProvider = null;
let unauthorizedHandler = null;

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
 * Core request helper wrapping native fetch.
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
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    token: explicitToken,
    baseUrl = getApiBaseUrl(),
    ...fetchOptions
  } = options;

  const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${cleanBaseUrl}/${endpoint.replace(/^\/+/, '')}`;

  const headers = { ...customHeaders };

  // Set default JSON Content-Type if sending a body and not already specified
  if (body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach Authorization header only if a non-empty string token is provided
  // Never send mock data, objects, or untrusted structures as tokens
  const activeToken = explicitToken !== undefined ? explicitToken : (tokenProvider ? tokenProvider() : null);
  if (typeof activeToken === 'string' && activeToken.trim()) {
    headers['Authorization'] = `Bearer ${activeToken.trim()}`;
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

  const response = await fetch(url, {
    method,
    headers,
    body: serializedBody,
    ...fetchOptions,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData = null;

  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    // Extract structured error format from IdentArchive backend: { success: false, error: { code, message, details } }
    const errorPayload = responseData && typeof responseData === 'object' ? responseData.error || responseData : null;
    const message = errorPayload?.message || (typeof responseData === 'string' && responseData.trim() ? responseData : `Request failed with status ${response.status}`);
    const code = errorPayload?.code;
    const details = errorPayload?.details || [];

    const apiError = new ApiError({
      message,
      status: response.status,
      code,
      details,
      data: responseData,
    });

    // Invoke unauthorized callback only on 401 Unauthorized, never on 403 Forbidden
    if (response.status === 401 && unauthorizedHandler) {
      try {
        unauthorizedHandler(apiError);
      } catch {
        // Do not let handler errors mask the original ApiError
      }
    }

    throw apiError;
  }

  return responseData;
}

export const apiClient = {
  get: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
  setTokenProvider,
  setUnauthorizedHandler,
};

export default apiClient;
