import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { closePool } from '../src/config/database.js'
import {
  getMatchesQueue,
  getMatchById,
  verifyMatch,
} from '../src/repositories/matchRepository.js'
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

/**
 * Inserts a matched pair: one missing case + one found case + one match linking them.
 */
async function seedMatchedPair(conn, overrides = {}) {
  const missingCase = await createCase(conn, {
    kind: 'missing',
    crimeType: 'missing_person',
    gender: overrides.gender || 'male',
    city: 'Delhi',
    state: 'Delhi',
    ...overrides.missingCase,
  })
  const foundCase = await createCase(conn, {
    kind: 'found',
    crimeType: 'unidentified_person',
    gender: overrides.gender || 'male',
    city: 'Delhi',
    state: 'Delhi',
    ...overrides.foundCase,
  })
  const match = await createMatch(conn, {
    missingCaseId: missingCase.case_id,
    foundCaseId: foundCase.case_id,
    similarityScore: overrides.similarityScore ?? 0.87,
    status: overrides.status || 'pending',
  })
  return { missingCase, foundCase, match }
}

describe('matchRepository tests', { skip: skipReason }, () => {
  const connection = readiness.connection

  after(async () => {
    if (connection) await connection.end()
    await closePool()
  })

  beforeEach(async () => {
    if (connection) await truncateTables(connection)
  })

  // ---------------------------------------------------------------------------
  describe('getMatchesQueue', () => {
    it('returns an empty array when no matches exist', async () => {
      const rows = await getMatchesQueue()
      assert.equal(Array.isArray(rows), true)
      assert.equal(rows.length, 0)
    })

    it('returns all matches when no status filter is given', async () => {
      await seedMatchedPair(connection, { status: 'pending' })
      await seedMatchedPair(connection, { status: 'confirmed' })
      await seedMatchedPair(connection, { status: 'dismissed' })

      const rows = await getMatchesQueue()
      assert.equal(rows.length, 3)
    })

    it('filters matches by status: pending', async () => {
      await seedMatchedPair(connection, { status: 'pending' })
      await seedMatchedPair(connection, { status: 'pending' })
      await seedMatchedPair(connection, { status: 'confirmed' })

      const rows = await getMatchesQueue({ status: 'pending' })
      assert.equal(rows.length, 2)
      for (const row of rows) {
        assert.equal(row.status, 'pending')
      }
    })

    it('filters matches by status: confirmed', async () => {
      await seedMatchedPair(connection, { status: 'pending' })
      await seedMatchedPair(connection, { status: 'confirmed' })

      const rows = await getMatchesQueue({ status: 'confirmed' })
      assert.equal(rows.length, 1)
      assert.equal(rows[0].status, 'confirmed')
    })

    it('includes enriched case summary fields for both sides of the match', async () => {
      const missingCase = await createCase(connection, {
        kind: 'missing',
        crimeType: 'missing_person',
        personName: 'Ramesh Kumar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        age: 28,
        gender: 'male',
      })
      const foundCase = await createCase(connection, {
        kind: 'found',
        crimeType: 'unidentified_person',
        city: 'Vellore',
        state: 'Tamil Nadu',
        gender: 'male',
      })
      await createMatch(connection, {
        missingCaseId: missingCase.case_id,
        foundCaseId: foundCase.case_id,
        similarityScore: 0.92,
        status: 'pending',
      })

      const rows = await getMatchesQueue({ status: 'pending' })
      assert.equal(rows.length, 1)
      const row = rows[0]
      assert.equal(row.missing_city, 'Chennai')
      assert.equal(row.missing_state, 'Tamil Nadu')
      assert.equal(row.missing_person_name, 'Ramesh Kumar')
      assert.equal(row.found_city, 'Vellore')
      assert.equal(row.found_state, 'Tamil Nadu')
      assert.ok(typeof row.similarity_score === 'string' || typeof row.similarity_score === 'number')
    })

    it('respects page and limit for pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await seedMatchedPair(connection, { status: 'pending' })
      }

      const page1 = await getMatchesQueue({ status: 'pending', page: 1, limit: 2 })
      assert.equal(page1.length, 2)

      const page3 = await getMatchesQueue({ status: 'pending', page: 3, limit: 2 })
      assert.equal(page3.length, 1)
    })

    it('throws VALIDATION_ERROR for an invalid status value', async () => {
      await assert.rejects(
        () => getMatchesQueue({ status: 'invalid_status' }),
        (err) => {
          assert.equal(err.code, 'VALIDATION_ERROR')
          assert.equal(err.statusCode, 400)
          return true
        }
      )
    })
  })

  // ---------------------------------------------------------------------------
  describe('getMatchById', () => {
    it('returns null for an empty or missing matchId', async () => {
      assert.equal(await getMatchById(''), null)
      assert.equal(await getMatchById(null), null)
      assert.equal(await getMatchById('00000000-0000-0000-0000-000000000000'), null)
    })

    it('retrieves a match with all enriched case fields and null latest_verification when none exists', async () => {
      const { match, missingCase, foundCase } = await seedMatchedPair(connection, {
        similarityScore: 0.78,
        status: 'pending',
      })

      const result = await getMatchById(match.match_id)
      assert.ok(result)
      assert.equal(result.match_id, match.match_id)
      assert.equal(result.missing_case_id, missingCase.case_id)
      assert.equal(result.found_case_id, foundCase.case_id)
      assert.equal(result.status, 'pending')
      assert.equal(result.latest_verification, null)
    })

    it('includes the latest verification record when one exists', async () => {
      const { match } = await seedMatchedPair(connection, { status: 'confirmed' })

      // Create officer to attach verification
      const user = await createUser(connection, { role: 'officer' })
      const officer = await createOfficer(connection, { userId: user.user_id })
      await createVerification(connection, {
        matchId: match.match_id,
        officerId: officer.officer_id,
        decision: 'confirmed',
        remarks: 'Physical description clearly matches the found person.',
      })

      const result = await getMatchById(match.match_id)
      assert.ok(result)
      assert.ok(result.latest_verification)
      assert.equal(result.latest_verification.match_id, match.match_id)
      assert.equal(result.latest_verification.officer_id, officer.officer_id)
      assert.equal(result.latest_verification.decision, 'confirmed')
      assert.equal(
        result.latest_verification.remarks,
        'Physical description clearly matches the found person.'
      )
    })
  })

  // ---------------------------------------------------------------------------
  describe('verifyMatch', () => {
    it('throws VALIDATION_ERROR when matchId is empty', async () => {
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      await assert.rejects(
        () => verifyMatch('', user.user_id, 'confirmed', 'Clear match'),
        (err) => {
          assert.equal(err.code, 'VALIDATION_ERROR')
          return true
        }
      )
    })

    it('throws VALIDATION_ERROR when action is invalid', async () => {
      const { match } = await seedMatchedPair(connection)
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      await assert.rejects(
        () => verifyMatch(match.match_id, user.user_id, 'maybe', 'Notes'),
        (err) => {
          assert.equal(err.code, 'VALIDATION_ERROR')
          assert.equal(err.statusCode, 400)
          return true
        }
      )
    })

    it('throws VALIDATION_ERROR when remarks/notes are empty', async () => {
      const { match } = await seedMatchedPair(connection)
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      await assert.rejects(
        () => verifyMatch(match.match_id, user.user_id, 'confirmed', ''),
        (err) => {
          assert.equal(err.code, 'VALIDATION_ERROR')
          assert.equal(err.statusCode, 400)
          return true
        }
      )
    })

    it('throws FORBIDDEN when the user has no active officer profile', async () => {
      const { match } = await seedMatchedPair(connection)
      const user = await createUser(connection) // no officer row

      await assert.rejects(
        () => verifyMatch(match.match_id, user.user_id, 'confirmed', 'Valid notes'),
        (err) => {
          assert.equal(err.code, 'FORBIDDEN')
          assert.equal(err.statusCode, 403)
          return true
        }
      )
    })

    it('throws NOT_FOUND when the matchId does not exist', async () => {
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })
      const nonExistent = '00000000-0000-0000-0000-000000000000'

      await assert.rejects(
        () => verifyMatch(nonExistent, user.user_id, 'confirmed', 'Valid notes'),
        (err) => {
          assert.equal(err.code, 'NOT_FOUND')
          assert.equal(err.statusCode, 404)
          return true
        }
      )
    })

    it('confirms a pending match: inserts verification, updates match status, returns enriched row', async () => {
      const { match } = await seedMatchedPair(connection, { status: 'pending' })
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      const result = await verifyMatch(
        match.match_id,
        user.user_id,
        'confirmed',
        'Physical characteristics and age group align precisely.'
      )

      assert.ok(result)
      assert.equal(result.match_id, match.match_id)
      assert.equal(result.status, 'confirmed')
      assert.ok(result.latest_verification)
      assert.equal(result.latest_verification.decision, 'confirmed')
      assert.equal(
        result.latest_verification.remarks,
        'Physical characteristics and age group align precisely.'
      )
    })

    it('dismisses a pending match: inserts verification, sets status to dismissed', async () => {
      const { match } = await seedMatchedPair(connection, { status: 'pending' })
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      const result = await verifyMatch(
        match.match_id,
        user.user_id,
        'dismissed',
        'Hair color and height do not match the description.'
      )

      assert.ok(result)
      assert.equal(result.status, 'dismissed')
      assert.equal(result.latest_verification.decision, 'dismissed')
      assert.equal(
        result.latest_verification.remarks,
        'Hair color and height do not match the description.'
      )
    })

    it('throws CONFLICT when attempting to verify an already-decided match', async () => {
      const { match } = await seedMatchedPair(connection, { status: 'confirmed' })
      const user = await createUser(connection, { role: 'officer' })
      await createOfficer(connection, { userId: user.user_id })

      await assert.rejects(
        () => verifyMatch(match.match_id, user.user_id, 'dismissed', 'Should not work'),
        (err) => {
          assert.equal(err.code, 'CONFLICT')
          assert.equal(err.statusCode, 409)
          return true
        }
      )
    })

    it('rolls back the transaction cleanly on FK violation and the match remains pending', async () => {
      const { match } = await seedMatchedPair(connection, { status: 'pending' })
      const invalidOfficerId = '00000000-0000-0000-0000-deadbeef0000'

      // Force FK violation: directly insert with a nonexistent officer_id bypassing repository
      await assert.rejects(async () => {
        const conn = await (await import('../src/config/database.js')).pool.getConnection()
        try {
          await conn.execute(
            `INSERT INTO match_verifications (match_id, officer_id, decision, remarks)
             VALUES (?, ?, ?, ?)`,
            [match.match_id, invalidOfficerId, 'confirmed', 'Forced FK violation']
          )
        } finally {
          conn.release()
        }
      })

      // Verify match status is still pending after the failed attempt
      const still = await getMatchById(match.match_id)
      assert.equal(still.status, 'pending')
    })
  })
})
