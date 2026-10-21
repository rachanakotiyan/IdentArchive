/**
 * auth-middleware.test.js
 *
 * Unit tests for authenticate and authorize middlewares.
 * authenticate is now async (M3).
 *
 * Tests that require a DB connection (deleted user, deactivated officer) are
 * covered in auth.test.js which runs against identarchive_test.
 *
 * These unit tests exercise only the JWT / claims layer; no MySQL connection is needed.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { authenticate } from '../src/middleware/authenticate.js'
import { authorize } from '../src/middleware/authorize.js'
import { signToken } from '../src/utils/token.js'
import { ROLES } from '../src/config/roles.js'
import config from '../src/config/index.js'

/**
 * Build a minimal fake req and collect the err passed to next().
 */
async function callAuthenticate(req) {
  return new Promise((resolve) => {
    authenticate(req, {}, (err) => resolve(err))
  })
}

describe('Authentication & Authorization Middlewares', () => {
  describe('authenticate middleware', () => {
    it('rejects requests with missing Authorization header', async () => {
      const err = await callAuthenticate({ headers: {} })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'UNAUTHORIZED')
    })

    it('rejects non-Bearer Authorization headers', async () => {
      const err = await callAuthenticate({ headers: { authorization: 'Basic dXNlcjpwYXNz' } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'UNAUTHORIZED')
    })

    it('rejects empty Bearer token', async () => {
      const err = await callAuthenticate({ headers: { authorization: 'Bearer ' } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'UNAUTHORIZED')
    })

    it('rejects tokens with invalid signatures', async () => {
      const err = await callAuthenticate({ headers: { authorization: 'Bearer invalid.token.signature' } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'INVALID_TOKEN')
    })

    it('rejects expired tokens with TOKEN_EXPIRED', async () => {
      const expiredToken = signToken({ userId: 'usr-001', role: ROLES.INDIVIDUAL }, '0s')
      await new Promise((resolve) => setTimeout(resolve, 50))
      const err = await callAuthenticate({ headers: { authorization: `Bearer ${expiredToken}` } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'TOKEN_EXPIRED')
    })

    it('rejects tokens with signed but invalid claims (e.g. unrecognized role)', async () => {
      const invalidClaimsToken = jwt.sign(
        { userId: 'usr-001', role: 'unrecognized_hacker_role' },
        config.auth.jwtSecret,
        { algorithm: 'HS256' }
      )
      const err = await callAuthenticate({ headers: { authorization: `Bearer ${invalidClaimsToken}` } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'INVALID_TOKEN')
      assert.match(err.message, /claims verification failed/)
    })

    it('rejects tokens with non-string userId claim', async () => {
      const invalidUserIdToken = jwt.sign(
        { userId: 12345, role: ROLES.INDIVIDUAL },
        config.auth.jwtSecret,
        { algorithm: 'HS256' }
      )
      const err = await callAuthenticate({ headers: { authorization: `Bearer ${invalidUserIdToken}` } })
      assert.ok(err)
      assert.equal(err.statusCode, 401)
      assert.equal(err.code, 'INVALID_TOKEN')
    })

    // Note: tests that verify "user no longer exists in DB" and "deactivated officer"
    // are covered in test/auth.test.js, which runs against identarchive_test.
  })

  describe('authorize middleware', () => {
    it('throws error on factory call if no roles are provided', () => {
      assert.throws(() => {
        authorize()
      }, /authorize middleware requires at least one allowed role/)
    })

    it('denies unauthenticated requests missing req.user', (t, done) => {
      const authMiddleware = authorize(ROLES.OFFICER)
      const req = {}
      authMiddleware(req, {}, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        done()
      })
    })

    it('denies user whose role is not in allowedRoles (403 FORBIDDEN)', (t, done) => {
      const authMiddleware = authorize(ROLES.OFFICER, ROLES.ADMIN)
      const req = { user: { userId: 'usr-citizen-1', role: ROLES.INDIVIDUAL } }
      authMiddleware(req, {}, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 403)
        assert.equal(err.code, 'FORBIDDEN')
        done()
      })
    })

    it('denies officer from accessing admin-only endpoint (403 FORBIDDEN)', (t, done) => {
      const authMiddleware = authorize(ROLES.ADMIN)
      const req = { user: { userId: 'usr-officer-1', role: ROLES.OFFICER } }
      authMiddleware(req, {}, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 403)
        assert.equal(err.code, 'FORBIDDEN')
        done()
      })
    })

    it('allows user with matching role to proceed', (t, done) => {
      const authMiddleware = authorize(ROLES.OFFICER, ROLES.ADMIN)
      const req = { user: { userId: 'usr-officer-1', role: ROLES.OFFICER } }
      authMiddleware(req, {}, (err) => {
        assert.equal(err, undefined)
        done()
      })
    })

    it('allows admin to proceed on admin-only route', (t, done) => {
      const authMiddleware = authorize(ROLES.ADMIN)
      const req = { user: { userId: 'usr-admin-1', role: ROLES.ADMIN } }
      authMiddleware(req, {}, (err) => {
        assert.equal(err, undefined)
        done()
      })
    })
  })
})
