import pool from '../config/database.js'

const DB_HEALTH_TIMEOUT_MS = 3000

/**
 * Checks MySQL database connectivity by executing a lightweight ping query (`SELECT 1 AS health`).
 *
 * @param {import('mysql2/promise').Pool} [dbPool=pool] - Connection pool instance (allows injection in tests)
 * @param {number} [timeoutMs=DB_HEALTH_TIMEOUT_MS] - Maximum time to wait for database response before timing out
 * @returns {Promise<{ connected: boolean, latencyMs: number | null, error?: string }>}
 */
export const checkDatabaseHealth = async (dbPool = pool, timeoutMs = DB_HEALTH_TIMEOUT_MS) => {
  const start = performance.now()
  let timer

  try {
    const queryPromise = dbPool.query('SELECT 1 AS health')
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const timeoutError = new Error('Database query timed out')
        timeoutError.code = 'ETIMEDOUT'
        reject(timeoutError)
      }, timeoutMs)
    })

    const [rows] = await Promise.race([queryPromise, timeoutPromise])
    clearTimeout(timer)
    const latencyMs = Math.round((performance.now() - start) * 100) / 100

    if (Array.isArray(rows) && rows.length > 0) {
      return {
        connected: true,
        latencyMs,
      }
    }

    return {
      connected: false,
      latencyMs: null,
      error: 'Database returned an unexpected response',
    }
  } catch (err) {
    clearTimeout(timer)
    // Sanitize completely: never leak credentials, SQL strings, passwords, or internal stack traces
    return {
      connected: false,
      latencyMs: null,
      error: 'Database connection unavailable',
    }
  }
}

/**
 * Retrieves overall application health and detailed database status.
 *
 * @param {import('mysql2/promise').Pool} [dbPool=pool] - Connection pool instance
 * @returns {Promise<{ status: string, message: string, database: { connected: boolean, latencyMs: number | null, error?: string } }>}
 */
export const getHealthStatus = async (dbPool = pool) => {
  const database = await checkDatabaseHealth(dbPool)

  return {
    status: 'ok',
    message: 'IdentArchive API is running',
    database,
  }
}

export default {
  getHealthStatus,
  checkDatabaseHealth,
}
