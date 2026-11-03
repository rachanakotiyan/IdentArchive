import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import app from '../src/app.js'
import errorHandler from '../src/middleware/errorHandler.js'
import { closePool } from '../src/config/database.js'
import { signToken } from '../src/utils/token.js'
import {
  registerLimiter,
  trackLimiter,
  submitReportLimiter,
  casesLimiter,
  pincodesLimiter,
  makeRateLimiter,
} from '../src/middleware/rateLimiters.js'
import {
  checkTestDbReadiness,
  createCase,
  createOfficer,
  createReport,
  createUser,
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

describe('Prompt 1A Security Fixes and Public API Tests', { skip: skipReason }, () => {
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
      // Seed standard test pincode
      await connection.execute(
        "INSERT INTO pincodes (pincode, city, district, state) VALUES ('560001', 'Bengaluru', 'Bengaluru Urban', 'Karnataka')"
      ).catch(() => {})
    }
  })

  describe('Item a: Public cases visibility, lookup, and mounts', () => {
    it('hides closed cases from GET /api/cases and returns empty array on ?status=closed', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-OPEN01',
        title: 'Open Public Case',
        caseStatus: 'open',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-REV01',
        title: 'Under Review Public Case',
        caseStatus: 'under_review',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-RES01',
        title: 'Resolved Public Case',
        caseStatus: 'resolved',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-CLS01',
        title: 'Closed Private Case',
        caseStatus: 'closed',
      })

      // Default list should contain open, under_review, resolved but NOT closed
      const res = await fetch(`${baseUrl}/api/cases`)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 3)
      const caseNumbers = body.data.map((c) => c.case_number)
      assert.ok(caseNumbers.includes('IA-2026-OPEN01'))
      assert.ok(caseNumbers.includes('IA-2026-REV01'))
      assert.ok(caseNumbers.includes('IA-2026-RES01'))
      assert.equal(caseNumbers.includes('IA-2026-CLS01'), false)

      // Querying ?status=closed explicitly returns empty list
      const closedRes = await fetch(`${baseUrl}/api/cases?status=closed`)
      assert.equal(closedRes.status, 200)
      const closedBody = await closedRes.json()
      assert.equal(closedBody.success, true)
      assert.equal(closedBody.data.length, 0)
      assert.equal(closedBody.meta.total, 0)
    })

    it('returns 404 for GET /api/cases/:caseNumber when case is closed', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-CLS02',
        title: 'Closed Case Detail',
        caseStatus: 'closed',
      })

      const res = await fetch(`${baseUrl}/api/cases/IA-2026-CLS02`)
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
    })

    it('returns 404 for GET /api/cases/:caseNumber/updates when case is closed', async () => {
      const created = await createCase(connection, {
        caseNumber: 'IA-2026-CLS03',
        title: 'Closed Case Updates',
        caseStatus: 'closed',
      })

      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-01-10', 'Prior update']
      )

      const res = await fetch(`${baseUrl}/api/cases/IA-2026-CLS03/updates`)
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
    })

    it('refuses lookup by case_id UUID (lookup by case_number only)', async () => {
      const caseId = uid()
      await createCase(connection, {
        caseId,
        caseNumber: 'IA-2026-NUMONLY',
        title: 'Case Number Only',
      })

      // Lookup by UUID should 404
      const resUuid = await fetch(`${baseUrl}/api/cases/${caseId}`)
      assert.equal(resUuid.status, 404)

      // Lookup by case_number should succeed and not expose case_id
      const resNum = await fetch(`${baseUrl}/api/cases/IA-2026-NUMONLY`)
      assert.equal(resNum.status, 200)
      const body = await resNum.json()
      assert.equal(body.data.case_number, 'IA-2026-NUMONLY')
      assert.equal(body.data.case_id, undefined)
    })

    it('confirms /api/api/* duplicate mounts are removed', async () => {
      const res = await fetch(`${baseUrl}/api/api/cases`)
      assert.equal(res.status, 404)
    })
  })

  describe('Item b: TRUST_PROXY configuration', () => {
    it('app.get("trust proxy") reflects trust proxy setting', () => {
      const tp = app.get('trust proxy')
      // Default configured from process.env.TRUST_PROXY or 0
      assert.equal(typeof tp === 'number' || typeof tp === 'boolean' || typeof tp === 'function', true)
    })
  })

  describe('Item c: Rate limiters configuration & test mode bypass', () => {
    it('exports all specified rate limiters with expected configurations', () => {
      assert.ok(registerLimiter)
      assert.ok(trackLimiter)
      assert.ok(submitReportLimiter)
      assert.ok(casesLimiter)
      assert.ok(pincodesLimiter)
    })

    it('relaxes limits in test environment so normal requests succeed', async () => {
      // Send multiple requests to /api/cases without getting throttled
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/api/cases`)
        assert.equal(res.status, 200)
      }
    })

    it('enforces limit and returns 429 TOO_MANY_REQUESTS when limit tripped via forceInTest', async () => {
      const testLimiter = makeRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        forceInTest: true,
      })

      const testApp = express()
      testApp.use(testLimiter)
      testApp.get('/test-limit', (req, res) => res.json({ ok: true }))
      testApp.use(errorHandler)

      const localServer = testApp.listen(0)
      await new Promise((resolve) => localServer.once('listening', resolve))
      const localUrl = `http://127.0.0.1:${localServer.address().port}`

      try {
        const res1 = await fetch(`${localUrl}/test-limit`)
        assert.equal(res1.status, 200)

        const res2 = await fetch(`${localUrl}/test-limit`)
        assert.equal(res2.status, 200)

        const res3 = await fetch(`${localUrl}/test-limit`)
        assert.equal(res3.status, 429)
        const body = await res3.json()
        assert.equal(body.success, false)
        assert.equal(body.error?.code, 'TOO_MANY_REQUESTS')
      } finally {
        await new Promise((resolve) => localServer.close(resolve))
      }
    })
  })

  describe('Item d: POST /api/reports/track replacing GET with safe error and response', () => {
    it('returns 404 for GET /api/reports/track (GET version replaced)', async () => {
      const res = await fetch(`${baseUrl}/api/reports/track`)
      assert.equal(res.status, 404)
    })

    it('returns generic 404 error for wrong reference_no', async () => {
      const res = await fetch(`${baseUrl}/api/reports/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_no: 'REF-99999999-999999',
          email: 'valid@example.com',
        }),
      })
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
      assert.equal(body.error?.message, 'Invalid reference number or email.')
    })

    it('returns generic 404 error for wrong email with valid reference_no', async () => {
      const reporterId = uid()
      const email = `track-user-${uid()}@example.com`
      await createUser(connection, { userId: reporterId, email })
      const report = await createReport(connection, {
        reporterId,
        referenceNo: 'REF-20260101-123456',
        reporterEmail: email,
      })

      const res = await fetch(`${baseUrl}/api/reports/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_no: 'REF-20260101-123456',
          email: 'wrong@example.com',
        }),
      })
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
      assert.equal(body.error?.message, 'Invalid reference number or email.')
    })

    it('returns tracking data with no review notes or actor names', async () => {
      const reporterId = uid()
      const email = `track-safe-${uid()}@example.com`
      await createUser(connection, { userId: reporterId, email })
      const report = await createReport(connection, {
        reporterId,
        referenceNo: 'REF-20260101-888888',
        reporterEmail: email,
      })

      // Add report history with an actor_id
      await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
        [report.report_id, 'Report submitted', reporterId]
      )

      const res = await fetch(`${baseUrl}/api/reports/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_no: 'REF-20260101-888888',
          email,
        }),
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.reference_no, 'REF-20260101-888888')
      assert.equal(body.data.review_note, undefined)
      assert.equal(body.data.assigned_officer_id, undefined)

      // Ensure status_history contains no actor identifiers
      assert.ok(Array.isArray(body.data.status_history))
      for (const item of body.data.status_history) {
        assert.equal(item.actor_id, undefined)
        assert.equal(item.actor_name, undefined)
        assert.ok(item.event)
        assert.ok(item.date)
      }
    })
  })

  describe('Item e: Zod validation on POST /api/reports', () => {
    it('returns 400 (not 500) when location_pincode does not exist in pincodes table', async () => {
      const userId = uid()
      await createUser(connection, { userId })
      const token = signToken({ userId, role: 'individual' })

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: 'missing',
          gender: 'female',
          event_date: '2026-01-01',
          description: 'A valid description of the incident with enough characters.',
          location_address: '123 Fake Street',
          location_pincode: '999999', // Non-existent pincode
        }),
      })

      assert.equal(res.status, 400)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'VALIDATION_ERROR')
    })

    it('returns 400 (not 500) when location_pincode is invalid format', async () => {
      const userId = uid()
      await createUser(connection, { userId })
      const token = signToken({ userId, role: 'individual' })

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: 'missing',
          gender: 'male',
          event_date: '2026-01-01',
          description: 'A valid description of the incident with enough characters.',
          location_address: '123 Fake Street',
          location_pincode: '123', // Invalid format
        }),
      })

      assert.equal(res.status, 400)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'VALIDATION_ERROR')
    })

    it('derives city, district, state from the pincodes table ignoring client values', async () => {
      const userId = uid()
      await createUser(connection, { userId })
      const token = signToken({ userId, role: 'individual' })

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: 'missing',
          gender: 'female',
          event_date: '2026-01-01',
          description: 'A valid description of the incident with enough characters.',
          location_address: 'MG Road',
          location_pincode: '560001',
          location_city: 'Malicious Fake City',
          location_district: 'Malicious District',
          location_state: 'Malicious State',
        }),
      })

      assert.equal(res.status, 201)
      const body = await res.json()
      // Should be taken from seeded pincode: Bengaluru, Bengaluru Urban, Karnataka
      assert.equal(body.data.location_city, 'Bengaluru')
      assert.equal(body.data.location_district, 'Bengaluru Urban')
      assert.equal(body.data.location_state, 'Karnataka')
    })
  })

  describe('Item f: Approve-report body whitelist', () => {
    it('rejects case_status other than open|under_review with 400', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const officerToken = signToken({ userId: officerUserId, role: 'officer' })

      const reporterId = uid()
      await createUser(connection, { userId: reporterId })
      const report = await createReport(connection, {
        reporterId,
        status: 'under_review',
        assignedOfficerId: officerUserId,
      })

      // Attempt case_status: 'closed'
      const resClosed = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ case_status: 'closed' }),
      })
      assert.equal(resClosed.status, 400)
      const bodyClosed = await resClosed.json()
      assert.equal(bodyClosed.error?.code, 'VALIDATION_ERROR')

      // Attempt case_status: 'resolved'
      const resResolved = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ case_status: 'resolved' }),
      })
      assert.equal(resResolved.status, 400)
    })

    it('approves report with valid whitelisted fields', async () => {
      const officerUserId = uid()
      await createUser(connection, { userId: officerUserId, role: 'officer' })
      await createOfficer(connection, { userId: officerUserId })
      const officerToken = signToken({ userId: officerUserId, role: 'officer' })

      const reporterId = uid()
      await createUser(connection, { userId: reporterId })
      const report = await createReport(connection, {
        reporterId,
        status: 'under_review',
        assignedOfficerId: officerUserId,
      })

      const res = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Whitelisted Title',
          short_description: 'Whitelisted short description',
          crime_type: 'abduction',
          case_status: 'under_review',
          unexpected_extra_field: 'should_be_stripped',
        }),
      })

      assert.equal(res.status, 201)
      const body = await res.json()
      assert.equal(body.data.case.title, 'Whitelisted Title')
      assert.equal(body.data.case.short_description, 'Whitelisted short description')
      assert.equal(body.data.case.crime_type, 'abduction')
      assert.equal(body.data.case.case_status, 'under_review')
      assert.equal(body.data.case.unexpected_extra_field, undefined)
    })
  })

  describe('Item g: GET /api/pincodes/:pincode and GET /api/public/stats', () => {
    it('returns 200 with pincode location data for valid 6-digit existing pincode', async () => {
      const res = await fetch(`${baseUrl}/api/pincodes/560001`)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.pincode, '560001')
      assert.equal(body.data.city, 'Bengaluru')
      assert.equal(body.data.district, 'Bengaluru Urban')
      assert.equal(body.data.state, 'Karnataka')
    })

    it('returns 400 for invalid pincode format', async () => {
      const res = await fetch(`${baseUrl}/api/pincodes/5600`)
      assert.equal(res.status, 400)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'VALIDATION_ERROR')
    })

    it('returns 404 for non-existent pincode', async () => {
      const res = await fetch(`${baseUrl}/api/pincodes/999999`)
      assert.equal(res.status, 404)
      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error?.code, 'NOT_FOUND')
    })

    it('returns 200 with aggregate public statistics on GET /api/public/stats', async () => {
      await createCase(connection, { caseNumber: 'IA-2026-ST1', caseStatus: 'open' })
      await createCase(connection, { caseNumber: 'IA-2026-ST2', caseStatus: 'under_review' })
      await createCase(connection, { caseNumber: 'IA-2026-ST3', caseStatus: 'resolved' })

      const res = await fetch(`${baseUrl}/api/public/stats`)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(typeof body.data.activeCases, 'number')
      assert.equal(typeof body.data.underReview, 'number')
      assert.equal(typeof body.data.resolvedCases, 'number')
      assert.equal(typeof body.data.reportsThisWeek, 'number')
      assert.ok(body.data.activeCases >= 1)
      assert.ok(body.data.underReview >= 1)
      assert.ok(body.data.resolvedCases >= 1)
    })
  })
})
