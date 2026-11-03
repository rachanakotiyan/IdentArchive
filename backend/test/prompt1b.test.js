import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'
import { signToken } from '../src/utils/token.js'
import {
  checkTestDbReadiness,
  createCase,
  createMatch,
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

describe('Prompt 1B Staff & Admin APIs, Scoping, and Match Verification', { skip: skipReason }, () => {
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

  // Helper: create officer with user
  async function setupOfficer(name = 'Officer User', district = 'Central') {
    const userId = uid()
    const email = `officer-${uid()}@test.local`
    await createUser(connection, { userId, name, email, role: 'officer' })
    const badge = `B-${uid().slice(0, 6)}`
    const officer = await createOfficer(connection, { userId, badge, district })
    const token = signToken({ userId, role: 'officer' })
    return { userId, email, badge, district, officer, token, officerId: officer.officer_id }
  }

  // Helper: create admin user (without officer profile)
  async function setupAdmin(name = 'Admin User') {
    const userId = uid()
    const email = `admin-${uid()}@test.local`
    await createUser(connection, { userId, name, email, role: 'admin' })
    const token = signToken({ userId, role: 'admin' })
    return { userId, email, token }
  }

  // Helper: create individual user
  async function setupIndividual(name = 'Individual User') {
    const userId = uid()
    const email = `indiv-${uid()}@test.local`
    await createUser(connection, { userId, name, email, role: 'individual' })
    const token = signToken({ userId, role: 'individual' })
    return { userId, email, token }
  }

  // -------------------------------------------------------------------------
  // 1. Role-based Access Control (RBAC) – Individuals get 403 Forbidden
  // -------------------------------------------------------------------------
  describe('RBAC: Individual user rejection (403 FORBIDDEN)', () => {
    it('denies individual access to staff and admin endpoints', async () => {
      const indiv = await setupIndividual()
      const dummyId = uid()

      const staffEndpoints = [
        { method: 'GET', path: '/api/staff/reports' },
        { method: 'GET', path: `/api/staff/reports/${dummyId}` },
        { method: 'PATCH', path: `/api/staff/reports/${dummyId}/priority`, body: { priority: 'urgent' } },
        { method: 'POST', path: `/api/staff/reports/${dummyId}/assign` },
        { method: 'POST', path: `/api/staff/reports/${dummyId}/approve`, body: {} },
        { method: 'GET', path: '/api/staff/cases' },
        { method: 'GET', path: `/api/staff/cases/${dummyId}` },
        { method: 'POST', path: `/api/staff/cases/${dummyId}/updates`, body: { note: 'test' } },
        { method: 'POST', path: `/api/staff/cases/${dummyId}/assign`, body: { officer_id: dummyId } },
        { method: 'PATCH', path: `/api/staff/cases/${dummyId}/status`, body: { status: 'resolved' } },
        { method: 'POST', path: `/api/staff/cases/${dummyId}/close`, body: { note: 'test' } },
        { method: 'GET', path: '/api/staff/dashboard' },
        { method: 'GET', path: '/api/admin/officers' },
        { method: 'GET', path: '/api/admin/users' },
        { method: 'GET', path: '/api/staff/matches' },
        { method: 'POST', path: `/api/staff/matches/${dummyId}/verify`, body: { action: 'confirmed', notes: 'test' } },
      ]

      for (const ep of staffEndpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${indiv.token}`,
            'Content-Type': 'application/json',
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        })
        assert.equal(
          res.status,
          403,
          `Expected 403 for ${ep.method} ${ep.path}, got ${res.status}`
        )
        const body = await res.json()
        assert.equal(body.error?.code || body.code, 'FORBIDDEN')
      }
    })
  })

  // -------------------------------------------------------------------------
  // 2. /api/staff/reports: Scoping, Detail, Priority, Assignment, Review Actions
  // -------------------------------------------------------------------------
  describe('/api/staff/reports: scoping and lifecycle', () => {
    it('scopes list to assigned or unassigned for officers; admin sees all', async () => {
      const offA = await setupOfficer('Officer A', 'North')
      const offB = await setupOfficer('Officer B', 'South')
      const admin = await setupAdmin('Super Admin')

      const reporter = await setupIndividual('Reporter')

      // Report 1: Assigned to Officer A
      const rep1 = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offA.officerId,
        referenceNo: 'REF-2026-000101',
      })

      // Report 2: Assigned to Officer B
      const rep2 = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offB.officerId,
        referenceNo: 'REF-2026-000102',
      })

      // Report 3: Unassigned
      const rep3 = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'submitted',
        referenceNo: 'REF-2026-000103',
      })

      // Officer A list: sees Rep1 (assigned to A) and Rep3 (unassigned), NOT Rep2 (assigned to B)
      const resA = await fetch(`${baseUrl}/api/staff/reports`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(resA.status, 200)
      const bodyA = await resA.json()
      const idsA = bodyA.data.map((r) => r.report_id)
      assert.ok(idsA.includes(rep1.report_id))
      assert.ok(idsA.includes(rep3.report_id))
      assert.equal(idsA.includes(rep2.report_id), false)

      // Officer A with assigned=me: only Rep1
      const resAMe = await fetch(`${baseUrl}/api/staff/reports?assigned=me`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      const bodyAMe = await resAMe.json()
      assert.equal(bodyAMe.data.length, 1)
      assert.equal(bodyAMe.data[0].report_id, rep1.report_id)

      // Officer A with assigned=unassigned: only Rep3
      const resAUnassigned = await fetch(`${baseUrl}/api/staff/reports?assigned=unassigned`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      const bodyAUnassigned = await resAUnassigned.json()
      assert.equal(bodyAUnassigned.data.length, 1)
      assert.equal(bodyAUnassigned.data[0].report_id, rep3.report_id)

      // Admin list: sees all three reports
      const resAdmin = await fetch(`${baseUrl}/api/staff/reports`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      })
      const bodyAdmin = await resAdmin.json()
      assert.equal(bodyAdmin.data.length, 3)
    })

    it('GET /api/staff/reports/:reportId returns detail with reporter contact, review_note, and history with actor names', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const reporter = await setupIndividual('Priya Sharma')

      const rep = await createReport(connection, {
        reporterId: reporter.userId,
        reporterName: 'Priya Sharma',
        reporterEmail: 'priya@example.com',
        reporterPhone: '9988776655',
        status: 'under_review',
        assignedOfficerId: offA.officerId,
        reviewNote: 'Initial assessment conducted.',
      })

      // Add audit history entries
      await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
        [rep.report_id, 'Report submitted', reporter.userId]
      )
      await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id) VALUES (?, ?, ?)',
        [rep.report_id, 'Report assigned for review', offA.userId]
      )

      // Officer A can view report detail
      const resA = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(resA.status, 200)
      const bodyA = await resA.json()
      assert.equal(bodyA.data.report_id, rep.report_id)
      assert.equal(bodyA.data.reporter_name, 'Priya Sharma')
      assert.equal(bodyA.data.reporter_email, 'priya@example.com')
      assert.equal(bodyA.data.reporter_phone, '9988776655')
      assert.equal(bodyA.data.review_note, 'Initial assessment conducted.')
      assert.ok(Array.isArray(bodyA.data.history))
      assert.equal(bodyA.data.history.length, 2)
      assert.equal(bodyA.data.history[0].actor_name, 'Priya Sharma')
      assert.equal(bodyA.data.history[1].actor_name, 'Officer Alpha')

      // Officer B cannot view Officer A\'s report (403)
      const resB = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}`, {
        headers: { Authorization: `Bearer ${offB.token}` },
      })
      assert.equal(resB.status, 403)
    })

    it('PATCH /api/staff/reports/:reportId/priority updates priority and logs in report_history', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const reporter = await setupIndividual('Reporter')

      const rep = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offA.officerId,
        priority: 'normal',
      })

      // Officer B tries to change priority of Officer A\'s report (403)
      const resB = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}/priority`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${offB.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority: 'urgent' }),
      })
      assert.equal(resB.status, 403)

      // Officer A updates priority to 'urgent'
      const resA = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}/priority`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${offA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority: 'urgent' }),
      })
      assert.equal(resA.status, 200)
      const bodyA = await resA.json()
      assert.equal(bodyA.data.priority, 'urgent')

      // Verify history logged
      const [histRows] = await connection.execute(
        'SELECT event, actor_id FROM report_history WHERE report_id = ? ORDER BY id DESC LIMIT 1',
        [rep.report_id]
      )
      assert.equal(histRows[0].event, 'Priority updated to URGENT')
      assert.equal(histRows[0].actor_id, offA.userId)
    })

    it('assignment rules: officer self-assigns unassigned only; admin assigns any active officer', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const admin = await setupAdmin('Admin Boss')
      const reporter = await setupIndividual('Reporter')

      const unassignedRep = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'submitted',
      })

      // Officer A self-assigns the unassigned report
      const resA = await fetch(`${baseUrl}/api/staff/reports/${unassignedRep.report_id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(resA.status, 200)
      const bodyA = await resA.json()
      assert.equal(bodyA.data.assigned_officer_id, offA.officerId)
      assert.equal(bodyA.data.status, 'under_review')

      // Officer B tries to self-assign the now-assigned report (409 CONFLICT)
      const resB = await fetch(`${baseUrl}/api/staff/reports/${unassignedRep.report_id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${offB.token}` },
      })
      assert.equal(resB.status, 409)

      // Admin without officer profile reassigns report to Officer B via { officer_id }
      const resAdmin = await fetch(`${baseUrl}/api/staff/reports/${unassignedRep.report_id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ officer_id: offB.officerId }),
      })
      assert.equal(resAdmin.status, 200)
      const bodyAdmin = await resAdmin.json()
      assert.equal(bodyAdmin.data.assigned_officer_id, offB.officerId)
    })

    it('officer cannot approve/reject/request-info on another officer\'s report', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const reporter = await setupIndividual('Reporter')

      const rep = await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offA.officerId,
      })

      // Officer B tries request-info on Officer A\'s report (403)
      const resInfo = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}/info-request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offB.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Need more info' }),
      })
      assert.equal(resInfo.status, 403)

      // Officer B tries reject on Officer A\'s report (403)
      const resReject = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offB.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejection_reason: 'Incomplete' }),
      })
      assert.equal(resReject.status, 403)

      // Officer B tries approve on Officer A\'s report (403)
      const resApprove = await fetch(`${baseUrl}/api/staff/reports/${rep.report_id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offB.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      assert.equal(resApprove.status, 403)
    })
  })

  // -------------------------------------------------------------------------
  // 3. /api/staff/cases: List, Detail, Updates, Status, Close, and Admin Assign
  // -------------------------------------------------------------------------
  describe('/api/staff/cases endpoints and operations', () => {
    it('scopes cases by officer assignment and allows full case lifecycle', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const admin = await setupAdmin('Admin Boss')
      const reporter = await setupIndividual('Reporter')

      // Case 1 linked to Report 1 assigned to Officer A
      const caseA = await createCase(connection, {
        caseNumber: 'IA-2026-STAFF01',
        title: 'Alpha Case',
        caseStatus: 'open',
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        caseId: caseA.case_id,
        assignedOfficerId: offA.officerId,
        referenceNo: 'REF-2026-CASE01',
      })

      // Case 2 linked to Report 2 assigned to Officer B
      const caseB = await createCase(connection, {
        caseNumber: 'IA-2026-STAFF02',
        title: 'Beta Case',
        caseStatus: 'open',
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        caseId: caseB.case_id,
        assignedOfficerId: offB.officerId,
        referenceNo: 'REF-2026-CASE02',
      })

      // List cases as Officer A: sees CaseA, NOT CaseB
      const resListA = await fetch(`${baseUrl}/api/staff/cases`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(resListA.status, 200)
      const bodyListA = await resListA.json()
      const numsA = bodyListA.data.map((c) => c.case_number)
      assert.ok(numsA.includes('IA-2026-STAFF01'))
      assert.equal(numsA.includes('IA-2026-STAFF02'), false)

      // List cases as Admin: sees both
      const resListAdmin = await fetch(`${baseUrl}/api/staff/cases`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      })
      const bodyListAdmin = await resListAdmin.json()
      assert.equal(bodyListAdmin.data.length, 2)

      // Detail: Officer A gets CaseA (200) with officer name/badge, updates, matches, history
      const resDetailA = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(resDetailA.status, 200)
      const bodyDetailA = await resDetailA.json()
      assert.equal(bodyDetailA.data.case_number, 'IA-2026-STAFF01')
      assert.equal(bodyDetailA.data.assigned_officer_name, 'Officer Alpha')
      assert.equal(bodyDetailA.data.assigned_officer_badge, offA.badge)
      assert.equal(bodyDetailA.data.report_reference_no, 'REF-2026-CASE01')
      assert.ok(Array.isArray(bodyDetailA.data.updates))
      assert.ok(Array.isArray(bodyDetailA.data.matches))

      // Detail: Officer B accessing CaseA returns 403 FORBIDDEN
      const resDetailB = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}`, {
        headers: { Authorization: `Bearer ${offB.token}` },
      })
      assert.equal(resDetailB.status, 403)

      // Add update: Officer A adds case note (POST /api/staff/cases/:caseId/updates)
      const resUpdate = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/updates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Lead verified with local witnesses.' }),
      })
      assert.equal(resUpdate.status, 201)
      const bodyUpdate = await resUpdate.json()
      assert.equal(bodyUpdate.data.note, 'Lead verified with local witnesses.')

      // Note > 255 chars returns 400
      const resLong = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/updates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'A'.repeat(300) }),
      })
      assert.equal(resLong.status, 400)

      // Reassign case: Admin only (POST /api/staff/cases/:caseId/assign)
      const resAssignOfficer = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ officer_id: offB.officerId }),
      })
      assert.equal(resAssignOfficer.status, 403) // Officer forbidden

      const resAssignAdmin = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ officer_id: offB.officerId }),
      })
      assert.equal(resAssignAdmin.status, 200)

      // PATCH status: open -> resolved
      const resStatus = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'resolved' }),
      })
      assert.equal(resStatus.status, 200)
      const bodyStatus = await resStatus.json()
      assert.equal(bodyStatus.data.case_status, 'resolved')

      // POST close: closes case and linked report, adds case_update
      const resClose = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/close`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Person found safe and returned to family.' }),
      })
      assert.equal(resClose.status, 200)
      const bodyClose = await resClose.json()
      assert.equal(bodyClose.data.case_status, 'closed')

      // Attempting to close an already closed case -> 409 CONFLICT
      const resCloseAgain = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/close`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Trying to close again' }),
      })
      assert.equal(resCloseAgain.status, 409)

      // Attempting to patch status of closed case -> 409 CONFLICT
      const resStatusClosed = await fetch(`${baseUrl}/api/staff/cases/${caseA.case_id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'open' }),
      })
      assert.equal(resStatusClosed.status, 409)
    })
  })

  // -------------------------------------------------------------------------
  // 4. GET /api/staff/dashboard: Scoped Metrics and Summary
  // -------------------------------------------------------------------------
  describe('GET /api/staff/dashboard', () => {
    it('returns caller-scoped counts, my items, recent activity, and 8-week trend', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const admin = await setupAdmin('Admin Boss')
      const reporter = await setupIndividual('Reporter')

      await createReport(connection, {
        reporterId: reporter.userId,
        status: 'submitted',
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offA.officerId,
      })

      const res = await fetch(`${baseUrl}/api/staff/dashboard`, {
        headers: { Authorization: `Bearer ${offA.token}` },
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.ok(body.data.reportsByStatus)
      assert.ok(body.data.casesByStatus)
      assert.ok(Array.isArray(body.data.casesByStatusList))
      assert.ok(body.data.myItems)
      assert.equal(body.data.myItems.reports, 1) // 1 under_review assigned to A
      assert.ok(Array.isArray(body.data.recentActivity))
      assert.ok(Array.isArray(body.data.reportsPerWeek))
      assert.equal(body.data.reportsPerWeek.length, 8)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Admin-Only Endpoints: /api/admin/officers & /api/admin/users
  // -------------------------------------------------------------------------
  describe('Admin only endpoints: /api/admin/officers and /api/admin/users', () => {
    it('returns officers list with workload and never exposes password_hash', async () => {
      const offA = await setupOfficer('Officer Alpha', 'North District')
      const admin = await setupAdmin('Admin Boss')
      const reporter = await setupIndividual('Reporter')

      // Give Officer A 2 active reports
      await createReport(connection, {
        reporterId: reporter.userId,
        status: 'under_review',
        assignedOfficerId: offA.officerId,
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        status: 'submitted',
        assignedOfficerId: offA.officerId,
      })

      const res = await fetch(`${baseUrl}/api/admin/officers?q=Alpha`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.ok(body.data.length >= 1)
      const found = body.data.find((o) => o.badge === offA.badge)
      assert.ok(found)
      assert.equal(found.name, 'Officer Alpha')
      assert.equal(found.district, 'North District')
      assert.equal(found.workload, 2)
      assert.equal('password_hash' in found, false)
      assert.equal('password' in found, false)
    })

    it('returns users list with pagination and search, never exposing password_hash', async () => {
      await setupOfficer('Officer Alpha')
      const admin = await setupAdmin('Admin Boss')
      const user = await setupIndividual('Secret User')

      const res = await fetch(`${baseUrl}/api/admin/users?q=Secret`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.data.length, 1)
      assert.equal(body.data[0].email, user.email)
      assert.equal('password_hash' in body.data[0], false)
      assert.equal('password' in body.data[0], false)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Matches Verification Scoping and Atomic Transaction
  // -------------------------------------------------------------------------
  describe('Matches: scoping and atomic verification transaction', () => {
    it('officers verify only matches where a case is linked to their reports; admin can verify any', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const offB = await setupOfficer('Officer Beta')
      const admin = await setupAdmin('Admin Boss')
      const reporter = await setupIndividual('Reporter')

      // Case 1 (missing) linked to Report 1 assigned to Officer A
      const caseMissing = await createCase(connection, {
        caseNumber: 'IA-2026-M0099',
        kind: 'missing',
        crimeType: 'missing_person',
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        caseId: caseMissing.case_id,
        assignedOfficerId: offA.officerId,
      })

      // Case 2 (found) linked to Report 2 assigned to Officer A
      const caseFound = await createCase(connection, {
        caseNumber: 'IA-2026-F0099',
        kind: 'found',
        crimeType: 'unidentified_person',
      })
      await createReport(connection, {
        reporterId: reporter.userId,
        caseId: caseFound.case_id,
        assignedOfficerId: offA.officerId,
      })

      // Create Match
      const match = await createMatch(connection, {
        missingCaseId: caseMissing.case_id,
        foundCaseId: caseFound.case_id,
        similarityScore: 0.92,
        status: 'pending',
      })

      // Officer B attempts to verify Match between Officer A\'s cases (403 FORBIDDEN)
      const resB = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offB.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirmed',
          notes: 'Attempted verification by unauthorized officer',
        }),
      })
      assert.equal(resB.status, 403)
      const bodyB = await resB.json()
      assert.equal(bodyB.error?.code, 'FORBIDDEN')

      // Officer A verifies Match -> 200 OK
      const resA = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${offA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirmed',
          notes: 'Verified by assigned officer Alpha',
        }),
      })
      assert.equal(resA.status, 200)
      const bodyA = await resA.json()
      assert.equal(bodyA.data.status, 'confirmed')

      // Deciding an already decided match -> 409 CONFLICT
      const resDecided = await fetch(`${baseUrl}/api/staff/matches/${match.match_id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dismissed',
          notes: 'Cannot decide already verified match',
        }),
      })
      assert.equal(resDecided.status, 409)
    })
  })

  // -------------------------------------------------------------------------
  // 7. Security: Public endpoints never expose reporter contact or internal fields
  // -------------------------------------------------------------------------
  describe('Security: Public endpoints never expose reporter contact or internal fields', () => {
    it('GET /api/cases and /api/cases/:caseNumber omit reporter and officer sensitive data', async () => {
      const offA = await setupOfficer('Officer Alpha')
      const reporter = await setupIndividual('Secret Reporter')

      const created = await createCase(connection, {
        caseNumber: 'IA-2026-PUBSEC01',
        title: 'Public Security Check Case',
        caseStatus: 'open',
      })

      await createReport(connection, {
        reporterId: reporter.userId,
        reporterName: 'Secret Reporter',
        reporterEmail: 'secret@leak.test',
        reporterPhone: '1122334455',
        caseId: created.case_id,
        assignedOfficerId: offA.officerId,
        reviewNote: 'Top secret internal note.',
      })

      // Public list
      const resList = await fetch(`${baseUrl}/api/cases`)
      assert.equal(resList.status, 200)
      const bodyList = await resList.json()
      const found = bodyList.data.find((c) => c.case_number === 'IA-2026-PUBSEC01')
      assert.ok(found)
      assert.equal('reporter_name' in found, false)
      assert.equal('reporter_email' in found, false)
      assert.equal('reporter_phone' in found, false)
      assert.equal('assigned_officer_id' in found, false)
      assert.equal('review_note' in found, false)
      assert.equal('case_id' in found, false)

      // Public detail
      const resDetail = await fetch(`${baseUrl}/api/cases/IA-2026-PUBSEC01`)
      assert.equal(resDetail.status, 200)
      const bodyDetail = await resDetail.json()
      assert.equal('reporter_name' in bodyDetail.data, false)
      assert.equal('reporter_email' in bodyDetail.data, false)
      assert.equal('reporter_phone' in bodyDetail.data, false)
      assert.equal('assigned_officer_id' in bodyDetail.data, false)
      assert.equal('review_note' in bodyDetail.data, false)
      assert.equal('case_id' in bodyDetail.data, false)
    })
  })
})

