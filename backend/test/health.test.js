import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { checkDatabaseHealth, getHealthStatus } from '../src/services/healthService.js'
import { closePool } from '../src/config/database.js'
import app from '../src/app.js'

describe('Database Health Check & Health Endpoint (Milestone 2)', () => {
  after(async () => {
    await closePool()
  })

  describe('checkDatabaseHealth service unit tests', () => {
    it('returns connected: true and latencyMs when query succeeds', async () => {
      const mockPool = {
        query: async (sql) => {
          assert.equal(sql, 'SELECT 1 AS health')
          return [[{ health: 1 }]]
        },
      }

      const result = await checkDatabaseHealth(mockPool)

      assert.equal(result.connected, true)
      assert.equal(typeof result.latencyMs, 'number')
      assert.ok(result.latencyMs >= 0)
      assert.equal(result.error, undefined)
    })

    it('returns connected: false and safe error message when query fails', async () => {
      const mockPool = {
        query: async () => {
          const err = new Error("Access denied for user 'identarchive_app'@'localhost' (using password: YES)")
          err.code = 'ER_ACCESS_DENIED_ERROR'
          throw err
        },
      }

      const result = await checkDatabaseHealth(mockPool)

      assert.equal(result.connected, false)
      assert.equal(result.latencyMs, null)
      assert.equal(result.error, 'Database connection unavailable')

      // Ensure sensitive data, raw error messages, and credentials are NOT exposed
      assert.equal(result.password, undefined)
      assert.equal(result.sqlMessage, undefined)
      assert.equal(result.stack, undefined)
    })

    it('returns connected: false when query times out', async () => {
      let timer
      const mockPool = {
        query: () =>
          new Promise((resolve) => {
            timer = setTimeout(resolve, 300)
          }),
      }

      try {
        // Pass a short timeout of 50ms
        const result = await checkDatabaseHealth(mockPool, 50)

        assert.equal(result.connected, false)
        assert.equal(result.latencyMs, null)
        assert.equal(result.error, 'Database connection unavailable')
      } finally {
        clearTimeout(timer)
      }
    })

    it('returns connected: false when query returns empty rows', async () => {
      const mockPool = {
        query: async () => [[]],
      }

      const result = await checkDatabaseHealth(mockPool)

      assert.equal(result.connected, false)
      assert.equal(result.latencyMs, null)
      assert.equal(result.error, 'Database returned an unexpected response')
    })
  })

  describe('getHealthStatus service unit tests', () => {
    it('combines application status with database status on success', async () => {
      const mockPool = {
        query: async () => [[{ health: 1 }]],
      }

      const result = await getHealthStatus(mockPool)

      assert.equal(result.status, 'ok')
      assert.equal(result.message, 'IdentArchive API is running')
      assert.deepEqual(result.database.connected, true)
      assert.equal(typeof result.database.latencyMs, 'number')
    })

    it('combines application status with database status on failure without throwing', async () => {
      const mockPool = {
        query: async () => {
          throw new Error('Connection refused')
        },
      }

      const result = await getHealthStatus(mockPool)

      assert.equal(result.status, 'ok')
      assert.equal(result.message, 'IdentArchive API is running')
      assert.equal(result.database.connected, false)
      assert.equal(result.database.latencyMs, null)
      assert.equal(result.database.error, 'Database connection unavailable')
    })
  })

  describe('GET /api/health HTTP Integration', () => {
    let server
    let baseUrl

    it('returns 200 with structured status and database information', async () => {
      server = app.listen(0)
      await new Promise((resolve) => server.once('listening', resolve))
      const port = server.address().port
      baseUrl = `http://127.0.0.1:${port}`

      try {
        const res = await fetch(`${baseUrl}/api/health`)
        assert.equal(res.status, 200)

        const body = await res.json()
        assert.equal(body.status, 'ok')
        assert.equal(body.message, 'IdentArchive API is running')
        assert.ok(body.database, 'database section must be present')
        assert.equal(typeof body.database.connected, 'boolean')

        if (body.database.connected) {
          assert.equal(typeof body.database.latencyMs, 'number')
        } else {
          assert.equal(body.database.latencyMs, null)
          assert.equal(body.database.error, 'Database connection unavailable')
        }
      } finally {
        if (server) {
          await new Promise((resolve) => server.close(resolve))
        }
      }
    })
  })
})
