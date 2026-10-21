import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import { signToken } from '../src/utils/token.js'
import {
  checkTestDbReadiness,
  createOfficer,
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

describe('End-to-end report-to-case integration flow (Phase 4b to 4c)', { skip: skipReason }, () => {
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

  it('transforms an approved report into an immediately searchable public case with detail and update retrieval', async () => {
    // 1. Setup reporter user and auth token
    const reporterUserId = uid()
    const reporterEmail = `reporter-${uid()}@flow.test`
    await createUser(connection, {
      userId: reporterUserId,
      email: reporterEmail,
      name: 'Priya Sharma',
      phone: '9876500001',
    })
    const reporterToken = signToken({ userId: reporterUserId, role: 'individual' })

    // 2. Setup reviewing officer user and profile
    const officerUserId = uid()
    const officerEmail = `officer-${uid()}@flow.test`
    await createUser(connection, {
      userId: officerUserId,
      email: officerEmail,
      name: 'Inspector Vijay Rao',
      role: 'officer',
    })
    await createOfficer(connection, {
      userId: officerUserId,
      badge: `B-${uid().slice(0, 6)}`,
      district: 'Bengaluru Urban',
    })
    const officerToken = signToken({ userId: officerUserId, role: 'officer' })

    // 3. Reporter submits a missing person report (Phase 4b intake)
    const reportPayload = {
      report_type: 'missing',
      person_name: 'Ananya Sharma',
      age: 15,
      gender: 'female',
      height_cm: 155,
      event_date: '2026-02-14',
      description: 'Teenage student last seen near Indiranagar Metro Station.',
      physical_features: 'Wears oval glasses, black shoulder-length hair.',
      identifying_marks: 'Small scar near right eyebrow.',
      location_address: '100 Feet Road, Indiranagar',
      location_pincode: '560038',
      location_city: 'Bengaluru',
      location_district: 'Bengaluru Urban',
      location_state: 'Karnataka',
    }

    const submitRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${reporterToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportPayload),
    })
    assert.equal(submitRes.status, 201)
    const submitBody = await submitRes.json()
    assert.equal(submitBody.success, true)
    const { report_id: reportId, reference_no: referenceNo } = submitBody.data
    assert.ok(reportId)
    assert.ok(referenceNo)

    // 4. Verify that unapproved report is NOT visible in public cases search
    const preApprovalSearch = await fetch(`${baseUrl}/api/cases?query=Ananya`)
    assert.equal(preApprovalSearch.status, 200)
    const preBody = await preApprovalSearch.json()
    assert.equal(preBody.success, true)
    assert.equal(preBody.data.length, 0)
    assert.equal(preBody.meta.total, 0)

    // 5. Officer reviews and approves the report (Phase 4b staff workflow)
    const assignRes = await fetch(`${baseUrl}/api/staff/reports/${reportId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerToken}` },
    })
    assert.equal(assignRes.status, 200)

    const approveRes = await fetch(`${baseUrl}/api/staff/reports/${reportId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Missing Child - Ananya Sharma (Indiranagar)',
      }),
    })
    assert.equal(approveRes.status, 201)
    const approveBody = await approveRes.json()
    assert.equal(approveBody.success, true)
    const createdCase = approveBody.data.case
    assert.ok(createdCase)
    const { case_number: caseNumber, case_id: caseId } = createdCase
    assert.ok(caseNumber)
    assert.match(caseNumber, /^IA-\d{4}-\d{4}$/)
    assert.equal(createdCase.kind, 'missing')
    assert.equal(createdCase.crime_type, 'missing_person')

    // 6. Phase 4c: Verify case is immediately searchable via GET /api/cases with query filter
    const searchRes = await fetch(`${baseUrl}/api/cases?query=Ananya`)
    assert.equal(searchRes.status, 200)
    const searchBody = await searchRes.json()
    assert.equal(searchBody.success, true)
    assert.equal(searchBody.data.length, 1)
    assert.equal(searchBody.meta.total, 1)
    assert.equal(searchBody.data[0].case_number, caseNumber)
    assert.equal(searchBody.data[0].person_name, 'Ananya Sharma')
    assert.equal(searchBody.data[0].gender, 'female')
    assert.equal(searchBody.data[0].city, 'Bengaluru')

    // 7. Verify multi-parameter filtering on GET /api/cases
    const filteredRes = await fetch(
      `${baseUrl}/api/cases?case_type=missing&gender=female&district=Bengaluru+Urban&state=Karnataka&age_min=10&age_max=20&pincode=560038`
    )
    assert.equal(filteredRes.status, 200)
    const filteredBody = await filteredRes.json()
    assert.equal(filteredBody.success, true)
    assert.equal(filteredBody.data.length, 1)
    assert.equal(filteredBody.data[0].case_number, caseNumber)

    // 8. Phase 4c: Retrieve case detail via GET /api/cases/:caseNumber
    const detailRes = await fetch(`${baseUrl}/api/cases/${encodeURIComponent(caseNumber)}`)
    assert.equal(detailRes.status, 200)
    const detailBody = await detailRes.json()
    assert.equal(detailBody.success, true)
    assert.equal(detailBody.data.case_number, caseNumber)
    assert.equal(detailBody.data.person_name, 'Ananya Sharma')
    assert.equal(detailBody.data.age, 15)
    assert.equal(detailBody.data.gender, 'female')
    assert.equal(detailBody.data.city, 'Bengaluru')
    assert.equal(detailBody.data.district, 'Bengaluru Urban')
    assert.equal(detailBody.data.state, 'Karnataka')
    assert.equal(detailBody.data.case_status, 'open')
    assert.equal(detailBody.data.physical_features, 'Wears oval glasses, black shoulder-length hair.')
    assert.equal(detailBody.data.identifying_marks, 'Small scar near right eyebrow.')

    // Verify privacy: reporter info and officer internal notes are never exposed in case details
    assert.equal('reporter_email' in detailBody.data, false)
    assert.equal('reporter_phone' in detailBody.data, false)
    assert.equal('reporter_name' in detailBody.data, false)
    assert.equal('assigned_officer_id' in detailBody.data, false)

    // 9. Phase 4c: Check case updates endpoint initially returns empty list
    const initialUpdatesRes = await fetch(`${baseUrl}/api/cases/${encodeURIComponent(caseNumber)}/updates`)
    assert.equal(initialUpdatesRes.status, 200)
    const initialUpdatesBody = await initialUpdatesRes.json()
    assert.equal(initialUpdatesBody.success, true)
    assert.equal(Array.isArray(initialUpdatesBody.data), true)
    assert.equal(initialUpdatesBody.data.length, 0)

    // 10. Add milestone update and verify retrieval via GET /api/cases/:caseNumber/updates
    await connection.execute(
      'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
      [caseId, '2026-02-15', 'Search operations initiated across Indiranagar Metro CCTV feeds.']
    )

    const updatedRes = await fetch(`${baseUrl}/api/cases/${encodeURIComponent(caseNumber)}/updates`)
    assert.equal(updatedRes.status, 200)
    const updatedBody = await updatedRes.json()
    assert.equal(updatedBody.success, true)
    assert.equal(updatedBody.data.length, 1)
    assert.equal(updatedBody.data[0].note, 'Search operations initiated across Indiranagar Metro CCTV feeds.')
    assert.equal(updatedBody.data[0].case_id, caseId)
  })
})
