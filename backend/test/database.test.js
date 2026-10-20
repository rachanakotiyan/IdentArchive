import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config/index.js'
import { pool, checkDatabaseConnection, closePool } from '../src/config/database.js'

describe('MySQL Database Configuration & Connection Pool (Milestone 1)', () => {
  it('exposes database configuration with expected default structure', () => {
    assert.ok(config.db, 'config.db should be defined')
    assert.equal(typeof config.db.host, 'string')
    assert.equal(typeof config.db.port, 'number')
    assert.equal(typeof config.db.user, 'string')
    assert.equal(typeof config.db.password, 'string')
    assert.equal(typeof config.db.database, 'string')
  })

  it('initializes a reusable MySQL promise pool with UTC timezone', () => {
    assert.ok(pool, 'pool instance should exist')
    assert.equal(typeof pool.query, 'function', 'pool.query should be a function')
    assert.equal(typeof pool.execute, 'function', 'pool.execute should be a function')
    assert.equal(typeof pool.getConnection, 'function', 'pool.getConnection should be a function')
    assert.equal(typeof pool.end, 'function', 'pool.end should be a function')

    // Inspect underlying pool options for UTC timezone (+00:00)
    const poolConfig = pool.pool?.config?.connectionConfig
    if (poolConfig) {
      assert.equal(poolConfig.timezone, '+00:00', 'connection timezone should be strictly +00:00 (UTC)')
    }
  })

  it('handles offline database status gracefully without throwing unhandled exceptions', async () => {
    // When local MySQL is offline or unreachable, checkDatabaseConnection returns an error object safely
    const result = await checkDatabaseConnection()
    assert.equal(typeof result, 'object')
    assert.equal(typeof result.ok, 'boolean')

    if (!result.ok) {
      assert.ok(result.code, 'Should contain sanitized error code (e.g. ECONNREFUSED)')
      assert.equal(typeof result.message, 'string')
      // Ensure passwords or secrets are never in the returned payload
      assert.equal(result.password, undefined)
      assert.equal(result.user, undefined)
    }
  })

  it('safely invokes closePool without error', async () => {
    // Re-closing an idle or unestablished pool should resolve without throwing
    await assert.doesNotReject(async () => {
      await closePool()
    })
  })
})
