import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import { signToken } from '../src/utils/token.js'
import {
  getMatchesQueue,
  getMatchById,
  verifyMatch,
} from '../src/controllers/matchController.js'
import {
  checkTestDbReadiness,
  createCase,
  createMatch,
  createOfficer,
  createUser,
  createVerification,
  DEFAULT_TEST_DB,
  truncateTables,
  validateTestDbName,
} from './helpers/test-db.js'

const testDbName = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
validateTestDbName(testDbName)
const readiness = await checkTestDbReadiness()
const skipReason = readiness.ok ? false : (readiness.reason || 'Test database unreachable')

function uid() {
  return crypto.randomUUID()
}

/**
 * Creates one missing case + one found case + one match linking them.
 */
async function seedMatch(conn, overrides = {}) {
  const missingCase = await createCase(conn, {
    kind: 'missing',
    crimeType: 'missing_person',
    personName: overrides.missingName || 'Missing Person',
    gender: 'female',
    city: 'Mumbai',
    state: 'Maharashtra',
  })
  const foundCase = await createCase(conn, {
    kind: 'found',
    crimeType: 'unidentified_person',
    personName: overrides.foundName || 'Found Person',
    gender: 'female',
    city: 'Pune',
    state: 'Maharashtra',
  })
  const match = await createMatch(conn, {
    missingCaseId: missingCase.case_id,
    foundCaseId: foundCase.case_id,
    similarityScore: overrides.similarityScore ?? 0.88,
    status: overrides.status || 'pending',
  })
  return { missingCase, foundCase, match }
}

describe('Match Review Endpoints and Controller Tests', { skip: skipReason }, () => {
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

  // =========================================================================
  // Unit tests for matchController functions
  // =========================================================================
  describe('Unit tests: matchController functions', () => {
    it('getMatchesQueue formats response with data and pagination meta', async () => {
      const mockReq = {
        query: { page: '1', limit: '10' },
      }
      let statusCode = null
      let responseBody = null
      const mockRes = {
        status(code) {
          statusCode = code
          return this
        },
        json(payload) {
          responseBody = payload
          return this
        },
      }
      let nextCalledWith = null
      const mockNext = (err) => {
        nextCalledWith = err
      }

      await getMatchesQueue(mockReq, mockRes, mockNext)

      assert.equal(nextCalledWith, null)
      assert.equal(statusCode, 200)
      assert.ok(responseBody)
      assert.equal(responseBody.success, true)
      assert.ok(Array.isArray(responseBody.data))
      assert.deepEqual(responseBody.meta, { page: 1, limit: 10, count: 0 })
    })

    it('getMatchById throws VALIDATION_ERROR 400 when matchId is missing', async () => {
      const mockReq = { params: { matchId: '' } }
      let nextError = null
      const mockNext = (err) => {
        nextError = err
      }

      await getMatchById(mockReq, {}, mockNext)

      assert.ok(nextError)
      assert.equal(nextError.statusCode, 400)
      assert.equal(nextError.code, 'VALIDATION_ERROR')
    })

    it('getMatchById throws NOT_FOUND 404 when match does not exist', async () => {
      const mockReq = { params: { matchId: uid() } }
      let nextError = null
      const mockNext = (err) => {
        nextError = err
      }

      await getMatchById(mockReq, {}, mockNext)

      assert.ok(nextError)
      assert.equal(nextError.statusCode, 404)
      assert.equal(nextError.code, 'NOT_FOUND')
    })

    it('verifyMatch throws VALIDATION_ERROR 400 when action is missing', async () => {
      const mockReq = {
        params: { matchId: uid() },
        body: { notes: 'Some notes' },
        user: { userId: uid() },
      }
      let nextError = null
      const mockNext = (err) => {
        nextError = err
      }

      await verifyMatch(mockReq, {}, mockNext)

      assert.ok(nextError)
      assert.equal(nextError.statusCode, 400)
      assert.equal(nextError.code, 'VALIDATION_ERROR')
    })

    it('verifyMatch throws VALIDATION_ERROR 400 when notes are missing', async () => {
      const mockReq = {
        params: { matchId: uid() },
        body: { action: 'confirmed', notes: '   ' },
        user: { userId: uid() },
      }
      let nextError = null
      const mockNext = (err) => {
        nextError = err
      }

      await verifyMatch(mockReq, {}, mockNext)

      assert.ok(nextError)
      assert.equal(nextError.statusCode, 400)
      assert.equal(nextError.code, 'VALIDATION_ERROR')
    })

    it('verifyMatch throws UNAUTHORIZED 401 when officer userId is missing from req.user', async () => {
      const mockReq = {
        params: { matchId: uid() },
        body: { action: 'confirmed', notes: 'Verified' },
        user: {},
      }
      let nextError = null
      const mockNext = (err) => {
        nextError = err
      }

      await verifyMatch(mockReq, {}, mockNext)

      assert.ok(nextError)
      assert.equal(nextError.statusCode, 401)
      assert.equal(nextError.code, 'UNAUTHORIZED')
    })
  })

  // =========================================================================
  // HTTP Integration: Authentication & Authorization guards
  // =========================================================================
  describe('HTTP Integration: Route Security', () => {
    it('returns 401 UNAUTHORIZED when no token is provided', async () => {
      const res = await fetch(`${baseUrl}/api/staff/matches`)
      assert.equal(res.status, 401)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code || body.code, 'UNAUTHORIZED')
    })

    it('returns 403 FORBIDDEN when user has "individual" role', async () => {
      const userId = uid()
      await createUser(connection, { userId, role: 'individual' })
      const token = signToken({ userId, role: 'individual' })

      const res = await fetch(`${baseUrl}/api/staff/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(res.status, 403)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code || body.code, 'FORBIDDEN')
    })
  })

  // =========================================================================
  // HTTP Integration: GET /api/staff/matches
  // =========================================================================
  describe('HTTP Integration: GET /api/staff/matches', () => {
    it('returns 200 with an empty queue when no matches exist', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const res = await fetch(`${baseUrl}/api/staff/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(Array.isArray(body.data), true)
      assert.equal(body.data.length, 0)
      assert.equal(body.meta.count, 0)
    })

    it('returns 200 with matches enriched with case details and filters by status', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      // Seed 2 pending matches and 1 confirmed match
      await seedMatch(connection, { status: 'pending', missingName: 'Alice' })
      await seedMatch(connection, { status: 'pending', missingName: 'Bob' })
      await seedMatch(connection, { status: 'confirmed', missingName: 'Charlie' })

      // Fetch pending queue
      const res = await fetch(`${baseUrl}/api/staff/matches?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 2)
      for (const item of body.data) {
        assert.equal(item.status, 'pending')
        assert.ok(item.missing_case_number)
        assert.ok(item.found_case_number)
        assert.ok(item.similarity_score !== undefined)
      }
    })

    it('paginates matches according to page and limit parameters', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      for (let i = 0; i < 3; i++) {
        await seedMatch(connection, { status: 'pending' })
      }

      const res = await fetch(`${baseUrl}/api/staff/matches?limit=2&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.data.length, 2)
      assert.equal(body.meta.limit, 2)
      assert.equal(body.meta.page, 1)
    })
  })

  // =========================================================================
  // HTTP Integration: GET /api/staff/matches/:matchId
  // =========================================================================
  describe('HTTP Integration: GET /api/staff/matches/:matchId', () => {
    it('returns 404 NOT_FOUND for a nonexistent matchId', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const nonExistent = uid()
      const res = await fetch(`${baseUrl}/api/staff/matches/${nonExistent}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code || body.code, 'NOT_FOUND')
    })

    it('returns 200 with match details, case summaries, and latest verification', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      const officer = await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const { match } = await seedMatch(connection, {
        status: 'confirmed',
        missingName: 'Priya Sharma',
      })

      await createVerification(connection, {
        matchId: match.match_id,
        officerId: officer.officer_id,
        decision: 'confirmed',
        remarks: 'Physical scar and birthmark match confirmed.',
      })

      const res = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.match_id, match.match_id)
      assert.equal(body.data.missing_person_name, 'Priya Sharma')
      assert.ok(body.data.latest_verification)
      assert.equal(body.data.latest_verification.decision, 'confirmed')
      assert.equal(
        body.data.latest_verification.remarks,
        'Physical scar and birthmark match confirmed.'
      )
    })
  })

  // =========================================================================
  // HTTP Integration: POST /api/staff/matches/:matchId/verify
  // =========================================================================
  describe('HTTP Integration: POST /api/staff/matches/:matchId/verify', () => {
    it('returns 400 VALIDATION_ERROR if action or remarks are missing', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const { match } = await seedMatch(connection, { status: 'pending' })

      // Missing action
      const res1 = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Some notes' }),
      })
      assert.equal(res1.status, 400)
      const body1 = await res1.json()
      assert.equal(body1.error?.code || body1.code, 'VALIDATION_ERROR')

      // Missing notes
      const res2 = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'confirmed', notes: '' }),
      })
      assert.equal(res2.status, 400)
      const body2 = await res2.json()
      assert.equal(body2.error?.code || body2.code, 'VALIDATION_ERROR')
    })

    it('verifies a match as confirmed and returns updated status and verification audit', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const { match } = await seedMatch(connection, { status: 'pending' })

      const res = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirmed',
          notes: 'Facial recognition and clothing markers verify this match.',
        }),
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.match_id, match.match_id)
      assert.equal(body.data.status, 'confirmed')
      assert.ok(body.data.latest_verification)
      assert.equal(body.data.latest_verification.decision, 'confirmed')
      assert.equal(
        body.data.latest_verification.remarks,
        'Facial recognition and clothing markers verify this match.'
      )
    })

    it('verifies a match as dismissed and updates status', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const { match } = await seedMatch(connection, { status: 'pending' })

      const res = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dismissed',
          remarks: 'Biometrics do not correspond to the missing person record.',
        }),
      })

      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.status, 'dismissed')
      assert.equal(body.data.latest_verification.decision, 'dismissed')
    })

    it('returns 409 CONFLICT when attempting to verify an already-decided match', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const token = signToken({ userId: officerUserId, role: 'officer' })

      const { match } = await seedMatch(connection, { status: 'confirmed' })

      const res = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dismissed',
          notes: 'Attempting to re-verify an already confirmed match.',
        }),
      })

      assert.equal(res.status, 409)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code || body.code, 'CONFLICT')
    })
  })
})
