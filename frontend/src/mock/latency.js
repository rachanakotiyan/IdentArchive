/**
 * Mock latency helper.
 * All service functions call withLatency() to simulate async behaviour.
 * Set mockConfig.simulateErrors = true to force every call to reject.
 */

export const mockConfig = {
  simulateErrors: false,
  minMs: 300,
  maxMs: 700,
};

/**
 * Wraps a value or factory in a random latency promise.
 * @template T
 * @param {T | (() => T)} valueOrFn
 * @returns {Promise<T>}
 */
export function withLatency(valueOrFn) {
  const delay =
    mockConfig.minMs +
    Math.random() * (mockConfig.maxMs - mockConfig.minMs);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (mockConfig.simulateErrors) {
        reject(new Error('Simulated server error (mockConfig.simulateErrors = true)'));
        return;
      }
      const value = typeof valueOrFn === 'function' ? valueOrFn() : valueOrFn;
      resolve(value);
    }, delay);
  });
}
