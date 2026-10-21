import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { closePool } from '../src/config/database.js'
import {
  searchCases,
  getCaseByNumber,
  getCaseUpdates,
  CASE_FIELDS,
} from '../src/repositories/caseRepository.js'
import {
  checkTestDbReadiness,
  createCase,
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

describe('caseRepository tests', { skip: skipReason }, () => {
  const connection = readiness.connection

  after(async () => {
    if (connection) await connection.end()
    await closePool()
  })

  beforeEach(async () => {
    if (connection) await truncateTables(connection)
  })

  describe('searchCases', () => {
    it('returns empty list when no cases exist', async () => {
      const results = await searchCases({}, connection)
      assert.equal(Array.isArray(results), true)
      assert.equal(results.length, 0)
      assert.equal(results.total, 0)
      assert.equal(results.page, 1)
      assert.equal(results.limit, 20)
    })

    it('searches cases with pagination and returns dual array/object shape', async () => {
      for (let i = 1; i <= 5; i++) {
        await createCase(connection, {
          caseNumber: `IA-2026-000${i}`,
          title: `Case number ${i}`,
          eventDate: `2026-01-0${i}`,
        })
      }

      // Page 1 with limit 2
      const page1 = await searchCases({ page: 1, limit: 2 }, connection)
      assert.equal(page1.length, 2)
      assert.equal(page1.total, 5)
      assert.equal(page1.page, 1)
      assert.equal(page1.limit, 2)
      assert.equal(page1.totalPages, 3)

      // Verify destructuring works as well
      const { cases, total, limit } = page1
      assert.equal(Array.isArray(cases), true)
      assert.equal(cases.length, 2)
      assert.equal(total, 5)
      assert.equal(limit, 2)

      // Page 3 with limit 2 (should have 1 item)
      const page3 = await searchCases({ page: 3, limit: 2 }, connection)
      assert.equal(page3.length, 1)
    })

    it('filters cases by case_type (kind: missing / found)', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-M001',
        title: 'Missing Child',
        kind: 'missing',
        crimeType: 'missing_person',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-F001',
        title: 'Found Individual',
        kind: 'found',
        crimeType: 'unidentified_person',
      })

      const missingOnly = await searchCases({ case_type: 'missing' }, connection)
      assert.equal(missingOnly.length, 1)
      assert.equal(missingOnly[0].case_number, 'IA-2026-M001')

      const foundOnly = await searchCases({ case_type: 'found' }, connection)
      assert.equal(foundOnly.length, 1)
      assert.equal(foundOnly[0].case_number, 'IA-2026-F001')
    })

    it('filters cases by crime_type via case_type parameter', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-CR1',
        title: 'Abduction investigation',
        kind: 'missing',
        crimeType: 'abduction',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-CR2',
        title: 'Standard missing person',
        kind: 'missing',
        crimeType: 'missing_person',
      })

      const abductionCases = await searchCases({ case_type: 'abduction' }, connection)
      assert.equal(abductionCases.length, 1)
      assert.equal(abductionCases[0].case_number, 'IA-2026-CR1')
    })

    it('filters cases by gender, district, and state', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-LOC1',
        gender: 'female',
        city: 'Mumbai',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-LOC2',
        gender: 'male',
        city: 'Pune',
        district: 'Pune District',
        state: 'Maharashtra',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-LOC3',
        gender: 'female',
        city: 'Bangalore',
        district: 'Bangalore Urban',
        state: 'Karnataka',
      })

      const femaleInMaharashtra = await searchCases(
        { gender: 'female', state: 'Maharashtra' },
        connection
      )
      assert.equal(femaleInMaharashtra.length, 1)
      assert.equal(femaleInMaharashtra[0].case_number, 'IA-2026-LOC1')

      const puneDistrict = await searchCases(
        { district: 'Pune District' },
        connection
      )
      assert.equal(puneDistrict.length, 1)
      assert.equal(puneDistrict[0].case_number, 'IA-2026-LOC2')
    })

    it('filters cases by age_min and age_max boundaries', async () => {
      await createCase(connection, { caseNumber: 'IA-2026-AGE1', age: 8 })
      await createCase(connection, { caseNumber: 'IA-2026-AGE2', age: 16 })
      await createCase(connection, { caseNumber: 'IA-2026-AGE3', age: 25 })
      await createCase(connection, { caseNumber: 'IA-2026-AGE4', age: 45 })

      const minors = await searchCases({ age_min: 10, age_max: 20 }, connection)
      assert.equal(minors.length, 1)
      assert.equal(minors[0].case_number, 'IA-2026-AGE2')

      const adultsOnly = await searchCases({ age_min: 25 }, connection)
      assert.equal(adultsOnly.length, 2)
    })

    it('filters cases by pincode via linked reports and pincodes lookup', async () => {
      const case1 = await createCase(connection, {
        caseNumber: 'IA-2026-PIN1',
        city: 'Bangalore',
        district: 'Bangalore Urban',
        state: 'Karnataka',
      })
      const user = await createUser(connection)
      // Link report with pincode 560001 to case1
      await createReport(connection, {
        reporterId: user.user_id,
        caseId: case1.case_id,
        locationPincode: '560001',
        locationDistrict: 'Bangalore Urban',
        locationState: 'Karnataka',
      })

      // Another case matching via pincodes table
      await createCase(connection, {
        caseNumber: 'IA-2026-PIN2',
        city: 'Mysore',
        district: 'Mysore District',
        state: 'Karnataka',
      })
      await connection.execute(
        'INSERT IGNORE INTO pincodes (pincode, city, district, state) VALUES (?, ?, ?, ?)',
        ['570001', 'Mysore', 'Mysore District', 'Karnataka']
      )

      const matchedByReportPin = await searchCases({ pincode: '560001' }, connection)
      assert.equal(matchedByReportPin.length, 1)
      assert.equal(matchedByReportPin[0].case_number, 'IA-2026-PIN1')

      const matchedByPincodeTable = await searchCases({ pincode: '570001' }, connection)
      assert.equal(matchedByPincodeTable.length, 1)
      assert.equal(matchedByPincodeTable[0].case_number, 'IA-2026-PIN2')
    })

    it('searches cases using query text parameter across fields', async () => {
      await createCase(connection, {
        caseNumber: 'IA-2026-SRCH1',
        title: 'Child Missing from park',
        personName: 'Rohan Sharma',
        city: 'Delhi',
      })
      await createCase(connection, {
        caseNumber: 'IA-2026-SRCH2',
        title: 'Senior Citizen Missing',
        personName: 'Devi Lal',
        city: 'Jaipur',
      })

      // Search by name
      const byName = await searchCases({ query: 'Rohan' }, connection)
      assert.equal(byName.length, 1)
      assert.equal(byName[0].case_number, 'IA-2026-SRCH1')

      // Search by case number
      const byCaseNo = await searchCases({ query: 'SRCH2' }, connection)
      assert.equal(byCaseNo.length, 1)
      assert.equal(byCaseNo[0].case_number, 'IA-2026-SRCH2')

      // Search by city
      const byCity = await searchCases({ query: 'Delhi' }, connection)
      assert.equal(byCity.length, 1)
      assert.equal(byCity[0].case_number, 'IA-2026-SRCH1')
    })
  })

  describe('getCaseByNumber', () => {
    it('returns null when caseNumber is missing or not found', async () => {
      assert.equal(await getCaseByNumber('', connection), null)
      assert.equal(await getCaseByNumber(null, connection), null)
      assert.equal(await getCaseByNumber('IA-9999-9999', connection), null)
    })

    it('retrieves an existing case by case_number', async () => {
      const created = await createCase(connection, {
        caseNumber: 'IA-2026-TARGET1',
        title: 'Target Case Retrieval',
        city: 'Chennai',
      })

      const found = await getCaseByNumber('IA-2026-TARGET1', connection)
      assert.ok(found)
      assert.equal(found.case_number, 'IA-2026-TARGET1')
      assert.equal(found.case_id, created.case_id)
      assert.equal(found.title, 'Target Case Retrieval')
      assert.equal(found.city, 'Chennai')
    })

    it('retrieves an existing case by case_id (UUID)', async () => {
      const caseId = crypto.randomUUID()
      await createCase(connection, {
        caseId,
        caseNumber: 'IA-2026-UUID1',
        title: 'UUID Case Retrieval',
      })

      const found = await getCaseByNumber(caseId, connection)
      assert.ok(found)
      assert.equal(found.case_number, 'IA-2026-UUID1')
      assert.equal(found.case_id, caseId)
    })
  })

  describe('getCaseUpdates', () => {
    it('returns empty array when caseNumber is missing or case has no updates', async () => {
      assert.deepEqual(await getCaseUpdates('', connection), [])
      assert.deepEqual(await getCaseUpdates(null, connection), [])
      assert.deepEqual(await getCaseUpdates('IA-9999-9999', connection), [])
    })

    it('retrieves ordered updates for a case using parameterized queries on cases and case_updates', async () => {
      const created = await createCase(connection, {
        caseNumber: 'IA-2026-UPDATES1',
        title: 'Case with updates',
      })

      // Insert multiple updates
      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-02-01', 'First update: Case opened and assigned']
      )
      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-02-05', 'Second update: Search team dispatched']
      )
      await connection.execute(
        'INSERT INTO case_updates (case_id, update_date, note) VALUES (?, ?, ?)',
        [created.case_id, '2026-02-10', 'Third update: Lead verified']
      )

      const updates = await getCaseUpdates('IA-2026-UPDATES1', connection)
      assert.equal(Array.isArray(updates), true)
      assert.equal(updates.length, 3)
      assert.equal(updates[0].note, 'First update: Case opened and assigned')
      assert.equal(updates[1].note, 'Second update: Search team dispatched')
      assert.equal(updates[2].note, 'Third update: Lead verified')

      // Also verify looking up by case_id
      const updatesById = await getCaseUpdates(created.case_id, connection)
      assert.equal(updatesById.length, 3)
    })
  })
})
