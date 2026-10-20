import mysql from 'mysql2/promise'
import config from './index.js'

const dbConfig = config?.db || {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || process.env.DB_APP_USER || 'identarchive_app',
  password: process.env.DB_PASSWORD ?? process.env.DB_APP_PASSWORD ?? '',
  database: process.env.DB_NAME || 'identarchive',
}

/**
 * Reusable MySQL Connection Pool
 *
 * Configured with:
 * - UTC timezone ('+00:00') to guarantee timestamp consistency across all layers
 * - Environment variables for host, port, user, password, and schema
 * - Non-blocking connection pooling with concurrency limits
 */
export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
  charset: 'utf8mb4',
})

// Ensure each newly acquired physical connection strictly enforces UTC session time_zone
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (err) => {
    if (err) {
      console.warn('[Database Warning] Failed to set session time_zone to UTC:', err.code || 'UNKNOWN')
    }
  })
})

/**
 * Safely tests the database connection without crashing if MySQL is offline.
 * Sanitizes output to ensure credentials and secrets are never logged.
 *
 * @returns {Promise<{ ok: boolean, code?: string, message?: string }>}
 */
export const checkDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection()
    try {
      await connection.query('SELECT 1')
      return { ok: true }
    } finally {
      connection.release()
    }
  } catch (error) {
    const safeCode = error.code || 'DB_CONNECTION_ERROR'
    // Log a safe warning containing only host/port/database - never passwords or credentials
    console.warn(
      `[Database Warning] Database connection unavailable (${safeCode}) at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}. ` +
      'Application continues running, but database features will be offline until MySQL is reachable.'
    )
    return {
      ok: false,
      code: safeCode,
      message: 'Database connection unavailable',
    }
  }
}

/**
 * Gracefully closes all connections in the pool.
 * Useful for graceful shutdown and automated testing teardowns.
 */
export const closePool = async () => {
  try {
    await pool.end()
  } catch (error) {
    console.warn('[Database Warning] Error closing MySQL pool:', error.code || 'UNKNOWN')
  }
}

export default pool
