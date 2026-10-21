import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import { signToken } from '../src/utils/token.js'
import {
  checkTestDbReadiness,
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

function listen() {
  const server = app.listen(0)
  return new Promise((resolve) => {
    server.once('listening', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve))
}

describe('Phase 4b report workflows', { skip: skipReason }, () => {
  let server
  let baseUrl
  const connection = readiness.connection

  before(async () => {
    ;({ server, baseUrl } = await listen())
  })

  after(async () => {
    if (server) await closeServer(server)
    if (connection) await connection.end()
    await closePool()
  })

  beforeEach(async () => {
    if (connection) await truncateTables(connection)
  })

  it('submits a schema-valid report and allows safe email-based tracking', async () => {
    const userId = uid()
    const email = `reporter-${uid()}@test.local`
    await createUser(connection, { userId, email, phone: '9876543210' })
    const token = signToken({ userId, role: 'individual' })

    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        report_type: 'missing',
        person_name: 'Test Person',
        gender: 'unknown',
        event_date: '2026-01-15',
        description: 'Test report details.',
        location_address: '10 Test Road',
        location_pincode: '560001',
        location_city: 'Bengaluru',
        location_district: 'Bengaluru Urban',
        location_state: 'Karnataka',
      }),
    })
    assert.equal(response.status, 201)
    const result = await response.json()
    const { report_id: reportId, reference_no: referenceNo } = result.data
    assert.ok(reportId)
    assert.match(referenceNo, /^REF-\d{8}-\d{6}$/)
    assert.equal(result.data.status, 'submitted')
    assert.equal('reporter_email' in result.data, false)
    assert.equal('assigned_officer_id' in result.data, false)

    const trackResponse = await fetch(
      `${baseUrl}/api/reports/track/${encodeURIComponent(referenceNo)}?email=${encodeURIComponent(email)}`
    )
    assert.equal(trackResponse.status, 200)
    const tracked = await trackResponse.json()
    assert.equal(tracked.data.reference_no, referenceNo)

    const myReportsResponse = await fetch(`${baseUrl}/api/reports/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(myReportsResponse.status, 200)
    const myReports = await myReportsResponse.json()
    assert.equal(myReports.data.length, 1)
    assert.equal(myReports.data[0].report_id, reportId)
  })

  it('assigns, reviews, rejects, and approves reports using schema identifiers and enums', async () => {
    const reporterId = uid()
    await createUser(connection, {
      userId: reporterId,
      email: `workflow-reporter-${uid()}@test.local`,
    })
    const officerUserId = uid()
    await createUser(connection, {
      userId: officerUserId,
      email: `workflow-officer-${uid()}@test.local`,
      role: 'officer',
    })
    const officer = await createOfficer(connection, { userId: officerUserId })
    const officerToken = signToken({ userId: officerUserId, role: 'officer' })
    const report = await createReport(connection, { reporterId })

    const queueResponse = await fetch(`${baseUrl}/api/staff/reports?status=submitted`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    })
    assert.equal(queueResponse.status, 200)
    const queue = await queueResponse.json()
    assert.equal(queue.data[0].report_id, report.report_id)

    const assignResponse = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerToken}` },
    })
    assert.equal(assignResponse.status, 200)
    const assigned = await assignResponse.json()
    assert.equal(assigned.data.assigned_officer_id, officer.officer_id)
    assert.equal(assigned.data.status, 'under_review')

    const infoResponse = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/info-request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: 'Please provide additional details.' }),
    })
    assert.equal(infoResponse.status, 200)
    const info = await infoResponse.json()
    assert.equal(info.data.status, 'info_requested')

    const rejectResponse = await fetch(`${baseUrl}/api/staff/reports/${report.report_id}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rejection_reason: 'Unable to verify the details.' }),
    })
    assert.equal(rejectResponse.status, 200)
    const rejected = await rejectResponse.json()
    assert.equal(rejected.data.status, 'rejected')

    const approvalReport = await createReport(connection, {
      reporterId,
      reportType: 'found',
      referenceNo: `REF-${uid().slice(0, 8)}`,
    })
    const approveResponse = await fetch(`${baseUrl}/api/staff/reports/${approvalReport.report_id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    assert.equal(approveResponse.status, 201)
    const approved = await approveResponse.json()
    assert.equal(approved.data.case.kind, 'found')
    assert.equal(approved.data.case.crime_type, 'unidentified_person')
    assert.match(approved.data.case.case_number, /^IA-\d{4}-\d{4}$/)

    const [history] = await connection.execute(
      'SELECT event FROM report_history WHERE report_id = ? ORDER BY id',
      [report.report_id]
    )
    assert.deepEqual(history.map((item) => item.event), [
      'Report assigned for review',
      'Additional information requested',
      'Report rejected',
    ])
    const [approvedHistory] = await connection.execute(
      'SELECT event FROM report_history WHERE report_id = ?',
      [approvalReport.report_id]
    )
    assert.equal(approvedHistory[0].event, 'Report approved and case created')
  })
})
