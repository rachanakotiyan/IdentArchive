import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkTestDbReadiness,
  truncateTables,
  createUser,
  createOfficer,
  createCase,
  createReport,
  createMatch,
  createVerification,
  DEFAULT_TEST_DB,
  validateTestDbName,
} from './helpers/test-db.js'

// Fail-fast guard: DB_TEST_NAME must end with '_test'
const testDbName = process.env.DB_TEST_NAME || DEFAULT_TEST_DB
validateTestDbName(testDbName)

// Top-level async readiness check to skip gracefully if MySQL/test DB is offline
const readiness = await checkTestDbReadiness()
const skipReason = readiness.ok ? false : (readiness.reason || 'Test database unreachable')

describe('Database Schema Constraints (identarchive_test)', { skip: skipReason }, () => {
  let connection

  before(async () => {
    if (readiness.ok) {
      connection = readiness.connection
    }
  })

  after(async () => {
    if (connection) {
      await connection.end()
    }
  })

  beforeEach(async () => {
    if (connection) {
      await truncateTables(connection)
    }
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 1. Duplicate user email (case-insensitive)
  // ---------------------------------------------------------------------------
  it('rejects duplicate user email case-insensitively (UNIQUE uq_users_email)', async () => {
    await createUser(connection, { email: 'officer.smith@example.com' })

    await assert.rejects(
      async () => {
        await createUser(connection, { email: 'OFFICER.SMITH@EXAMPLE.COM' })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(err.message),
          `Expected ER_DUP_ENTRY, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 2. Invalid role
  // ---------------------------------------------------------------------------
  it('rejects invalid user role not defined in ENUM (strict SQL mode)', async () => {
    await assert.rejects(
      async () => {
        await createUser(connection, { role: 'superadmin' })
      },
      (err) => {
        assert.ok(
          err.code === 'WARN_DATA_TRUNCATED' ||
          err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' ||
          err.code === 'ER_DATA_TRUNCATED' ||
          /truncated/i.test(err.message),
          `Expected ENUM truncation error, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 3. Second officer profile for the same user
  // ---------------------------------------------------------------------------
  it('rejects second officer profile for the same user (UNIQUE uq_officers_user)', async () => {
    const user = await createUser(connection, { role: 'officer' })
    await createOfficer(connection, { userId: user.user_id, badge: 'BADGE-101' })

    await assert.rejects(
      async () => {
        await createOfficer(connection, { userId: user.user_id, badge: 'BADGE-102' })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(err.message),
          `Expected ER_DUP_ENTRY for duplicate user_id in officers, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 4. Duplicate match pair
  // ---------------------------------------------------------------------------
  it('rejects duplicate match pair between same missing and found cases (UNIQUE uq_match_pair)', async () => {
    const missing = await createCase(connection, { kind: 'missing' })
    const found = await createCase(connection, { kind: 'found' })

    await createMatch(connection, {
      missingCaseId: missing.case_id,
      foundCaseId: found.case_id,
    })

    await assert.rejects(
      async () => {
        await createMatch(connection, {
          missingCaseId: missing.case_id,
          foundCaseId: found.case_id,
        })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(err.message),
          `Expected ER_DUP_ENTRY on uq_match_pair, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 5. Similarity score above 1
  // ---------------------------------------------------------------------------
  it('rejects similarity_score above 1.00 via CHECK constraint (ck_matches_score)', async () => {
    const missing = await createCase(connection, { kind: 'missing' })
    const found = await createCase(connection, { kind: 'found' })

    await assert.rejects(
      async () => {
        await createMatch(connection, {
          missingCaseId: missing.case_id,
          foundCaseId: found.case_id,
          similarityScore: 1.05,
        })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /check constraint.*violated/i.test(err.message),
          `Expected ER_CHECK_CONSTRAINT_VIOLATED, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 6. Match whose missing side is a 'found' case (and the reverse)
  // ---------------------------------------------------------------------------
  it("rejects a match whose missing side is a 'found' case (composite FK constraint)", async () => {
    const found1 = await createCase(connection, { kind: 'found' })
    const found2 = await createCase(connection, { kind: 'found' })

    await assert.rejects(
      async () => {
        await createMatch(connection, {
          missingCaseId: found1.case_id, // kind is 'found', not 'missing'
          foundCaseId: found2.case_id,
        })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_NO_REFERENCED_ROW_2' ||
          err.code === 'ER_NO_REFERENCED_ROW' ||
          /foreign key constraint fails/i.test(err.message),
          `Expected FK constraint failure on missing side, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  it("rejects a match whose found side is a 'missing' case (reverse composite FK constraint)", async () => {
    const missing1 = await createCase(connection, { kind: 'missing' })
    const missing2 = await createCase(connection, { kind: 'missing' })

    await assert.rejects(
      async () => {
        await createMatch(connection, {
          missingCaseId: missing1.case_id,
          foundCaseId: missing2.case_id, // kind is 'missing', not 'found'
        })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_NO_REFERENCED_ROW_2' ||
          err.code === 'ER_NO_REFERENCED_ROW' ||
          /foreign key constraint fails/i.test(err.message),
          `Expected FK constraint failure on found side, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 7. Second report linked to the same case
  // ---------------------------------------------------------------------------
  it('rejects a second report linked to the same case (UNIQUE uq_reports_case)', async () => {
    const user = await createUser(connection)
    const c = await createCase(connection, { kind: 'missing' })

    await createReport(connection, { reporterId: user.user_id, caseId: c.case_id })

    await assert.rejects(
      async () => {
        await createReport(connection, { reporterId: user.user_id, caseId: c.case_id })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(err.message),
          `Expected ER_DUP_ENTRY on uq_reports_case, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 8. Report without reporter_id
  // ---------------------------------------------------------------------------
  it('rejects a report without reporter_id (NOT NULL column violation)', async () => {
    await assert.rejects(
      async () => {
        await createReport(connection, { reporterId: null })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_BAD_NULL_ERROR' || /cannot be null/i.test(err.message),
          `Expected ER_BAD_NULL_ERROR for reporter_id, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 9. Deleting an officer who has verifications
  // ---------------------------------------------------------------------------
  it('rejects deleting an officer who has verifications (FK RESTRICT)', async () => {
    const user = await createUser(connection, { role: 'officer' })
    const officer = await createOfficer(connection, { userId: user.user_id })
    const missing = await createCase(connection, { kind: 'missing' })
    const found = await createCase(connection, { kind: 'found' })
    const match = await createMatch(connection, {
      missingCaseId: missing.case_id,
      foundCaseId: found.case_id,
    })
    await createVerification(connection, {
      matchId: match.match_id,
      officerId: officer.officer_id,
    })

    await assert.rejects(
      async () => {
        await connection.query('DELETE FROM officers WHERE officer_id = ?', [officer.officer_id])
      },
      (err) => {
        assert.ok(
          err.code === 'ER_ROW_IS_REFERENCED_2' ||
          err.code === 'ER_ROW_IS_REFERENCED' ||
          /foreign key constraint fails/i.test(err.message),
          `Expected FK RESTRICT violation on officer delete, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE REJECTED: 10. Age 200
  // ---------------------------------------------------------------------------
  it('rejects case age 200 via CHECK constraint (ck_cases_age 0-130)', async () => {
    await assert.rejects(
      async () => {
        await createCase(connection, { age: 200 })
      },
      (err) => {
        assert.ok(
          err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /check constraint.*violated/i.test(err.message),
          `Expected ER_CHECK_CONSTRAINT_VIOLATED for age 200, got ${err.code}: ${err.message}`
        )
        return true
      }
    )
  })

  // ---------------------------------------------------------------------------
  // PROVE BEHAVIOR: 1. Deleting a case cascades to its matches and sets reports.case_id to NULL
  // ---------------------------------------------------------------------------
  it('cascades case deletion to its matches and sets reports.case_id to NULL', async () => {
    const user = await createUser(connection)
    const missing = await createCase(connection, { kind: 'missing' })
    const found = await createCase(connection, { kind: 'found' })
    const match = await createMatch(connection, {
      missingCaseId: missing.case_id,
      foundCaseId: found.case_id,
    })
    const report = await createReport(connection, {
      reporterId: user.user_id,
      caseId: missing.case_id,
    })

    // Verify initial state
    const [initialMatches] = await connection.query(
      'SELECT match_id FROM matches WHERE match_id = ?',
      [match.match_id]
    )
    assert.equal(initialMatches.length, 1)

    const [initialReports] = await connection.query(
      'SELECT case_id FROM reports WHERE report_id = ?',
      [report.report_id]
    )
    assert.equal(initialReports[0].case_id, missing.case_id)

    // Execute case deletion
    await connection.query('DELETE FROM cases WHERE case_id = ?', [missing.case_id])

    // Match must be cascaded and deleted
    const [remainingMatches] = await connection.query(
      'SELECT match_id FROM matches WHERE match_id = ?',
      [match.match_id]
    )
    assert.equal(remainingMatches.length, 0, 'Match must be cascaded and removed')

    // Report must still exist, with case_id set to NULL
    const [remainingReports] = await connection.query(
      'SELECT report_id, case_id FROM reports WHERE report_id = ?',
      [report.report_id]
    )
    assert.equal(remainingReports.length, 1, 'Report must still exist')
    assert.equal(remainingReports[0].case_id, null, 'reports.case_id must be set to NULL')
  })

  // ---------------------------------------------------------------------------
  // PROVE BEHAVIOR: 2. Valid match is accepted
  // ---------------------------------------------------------------------------
  it('accepts a valid match between missing and found cases', async () => {
    const missing = await createCase(connection, { kind: 'missing' })
    const found = await createCase(connection, { kind: 'found' })

    const match = await createMatch(connection, {
      missingCaseId: missing.case_id,
      foundCaseId: found.case_id,
      similarityScore: 0.85,
    })

    const [rows] = await connection.query(
      'SELECT match_id, missing_case_id, missing_kind, found_case_id, found_kind, similarity_score, status FROM matches WHERE match_id = ?',
      [match.match_id]
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0].match_id, match.match_id)
    assert.equal(rows[0].missing_case_id, missing.case_id)
    assert.equal(rows[0].found_case_id, found.case_id)
    assert.equal(rows[0].missing_kind, 'missing')
    assert.equal(rows[0].found_kind, 'found')
    assert.equal(Number(rows[0].similarity_score), 0.85)
    assert.equal(rows[0].status, 'pending')
  })
})
