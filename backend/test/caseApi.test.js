import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import {
  getCases,
  getCaseByNumber,
  getCaseUpdates,
} from '../src/controllers/caseController.js'
import {
  checkTestDbReadiness,
  createCase,
  DEFAULT_TEST_DB,
  truncateTables,
  validateTestDbName,
} from './helpers/test-db.js'

const testDbName = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
validateTestDbName(testDbName)
const readiness = await checkTestDbReadiness()
const skipReason = readiness.ok ? false : (readiness.reason || 'Test database unreachable')

describe('Case Endpoints and Controller Tests', { skip: skipReason }, () => {
  let server
  let baseUrl
  const connection = readiness.connection

  before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (connection) {
      await connection.end()
    }
    await closePool()
  })

  beforeEach(async () => {
    if (connection) {
      await truncateTables(connection)
    }
  })

  describe('Unit tests for caseController functions', () => {
    it('getCases formats success response with data and pagination meta', async () => {
      const mockReq = {
        query: { page: '1', limit: '10' },
      }
      let statusCalled = null
      let jsonCalled = null
      const mockRes = {
        status(code) {
          statusCalled = code
          return this
        },
        json(payload) {
          jsonCalled = payload
          return this
        },
      }
      let nextCalled = null

      await getCases(mockReq, mockRes, (err) => {
        nextCalled = err
      })

      assert.equal(nextCalled, null)
      assert.equal(statusCalled, 200)
      assert.ok(jsonCalled)
      assert.equal(jsonCalled.success, true)
      assert.equal(Array.isArray(jsonCalled.data), true)
      assert.equal(typeof jsonCalled.meta, 'object')
      assert.equal(jsonCalled.meta.page, 1)
      assert.equal(jsonCalled.meta.limit, 10)
    })

    it('getCaseByNumber invokes next with 404 AppError when case not found', async () => {
      const mockReq = {
        params: { caseNumber: 'IA-9999-0000' },
      }
      const mockRes = {}
      let nextErr = null

      await getCaseByNumber(mockReq, mockRes, (err) => {
        nextErr = err
      })

      assert.ok(nextErr)
      assert.equal(nextErr.statusCode, 404)
      assert.equal(nextErr.code, 'NOT_FOUND')
      assert.equal(nextErr.message, 'Case not found')
    })

    it('getCaseUpdates invokes next with 404 AppError when parent case not found', async () => {
      const mockReq = {
        params: { caseNumber: 'IA-9999-0000' },
      }
      const mockRes = {}
      let nextErr = null

      await getCaseUpdates(mockReq, mockRes, (err) => {
        nextErr = err
      })

      assert.ok(nextErr)
      assert.equal(nextErr.statusCode, 404)
      assert.equal(nextErr.code, 'NOT_FOUND')
      assert.equal(nextErr.message, 'Case not found')
    })
  })

  describe('HTTP Integration: GET /api/cases', () => {
    it('returns 200 with structured response formatting and empty data when no cases exist', async () => {
      const res = await fetch(`${baseUrl}/api/cases`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(Array.isArray(body.data), true)
      assert.equal(body.data.length, 0)
      assert.ok(body.meta)
      assert.equal(body.meta.total, 0)
      assert.equal(body.meta.page, 1)
      assert.equal(body.meta.limit, 20)
    })

    it('returns 200 with matching cases and proper pagination meta', async () => {
      for (let i = 1; i <= 3; i++) {
        await createCase(connection, {
          caseNumber: `IA-2026-HTTP0${i}`,
          title: `Http Case ${i}`,
          kind: 'missing',
          crimeType: 'missing_person',
          gender: 'female',
          city: 'Mumbai',
          state: 'Maharashtra',
        })
      }

      const res = await fetch(`${baseUrl}/api/cases?page=1&limit=2`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 2)
      assert.equal(body.meta.total, 3)
      assert.equal(body.meta.page, 1)
      assert.equal(body.meta.limit, 2)
      assert.equal(body.meta.totalPages, 2)
    })

    it('filters cases by query parameters (gender, state, case_type)', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-FLT1',
        title: 'Missing Girl',
        kind: 'missing',
        gender: 'female',
        state: 'Karnataka',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-FLT2',
        title: 'Found Boy',
        kind: 'found',
        gender: 'male',
        state: 'Maharashtra',
      })

      const res = await fetch(`${baseUrl}/api/cases?gender=female&state=Karnataka&case_type=missing`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 1)
      assert.equal(body.data[0].case_number, 'IA-2026-FLT1')
    })
  })

  describe('HTTP Integration: GET /api/cases/:caseNumber', () => {
    it('returns 200 with case details for an existing case number', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-DETAIL1',
        title: 'Detail Test Case',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
      })

      const res = await fetch(`${baseUrl}/api/cases/IA-2026-DETAIL1`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.case_number, 'IA-2026-DETAIL1')
      assert.equal(body.data.title, 'Detail Test Case')
      assert.equal(body.data.city, 'Hyderabad')
      assert.equal(body.data.state, 'Telangana')
    })

    it('returns 404 with structured error payload when case number does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/cases/IA-NONEXISTENT-9999`)
      assert.equal(res.status, 404)

      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
      assert.equal(body.error?.message, 'Case not found')
    })
  })

  describe('HTTP Integration: GET /api/cases/:caseNumber/updates', () => {
    it('returns 200 with empty array when case exists but has no updates', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-NOUPDATES',
        title: 'Case without updates',
      })

      const res = await fetch(`${baseUrl}/api/cases/IA-2026-NOUPDATES/updates`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(Array.isArray(body.data), true)
      assert.equal(body.data.length, 0)
    })

    it('returns 200 with chronological milestones when updates exist', async () => {
      const created = await createCase(connection, {
        caseNumber: 'IA-2026-WITHUPDATES',
        title: 'Case with milestones',
      })

      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-03-01', 'Initial verification underway']
      )
      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-03-05', 'CCTV footage confirmed']
      )

      const res = await fetch(`${baseUrl}/api/cases/IA-2026-WITHUPDATES/updates`)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 2)
      assert.equal(body.data[0].note, 'Initial verification underway')
      assert.equal(body.data[1].note, 'CCTV footage confirmed')
    })

    it('returns 404 with structured error payload when requesting updates for a non-existent case', async () => {
      const res = await fetch(`${baseUrl}/api/cases/IA-NONEXISTENT-8888/updates`)
      assert.equal(res.status, 404)

      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
      assert.equal(body.error?.message, 'Case not found')
    })
  })
})
