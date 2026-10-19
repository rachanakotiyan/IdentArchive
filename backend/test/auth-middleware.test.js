import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { authenticate } from '../src/middleware/authenticate.js'
import { authorize } from '../src/middleware/authorize.js'
import { signToken } from '../src/utils/token.js'
import { ROLES } from '../src/config/roles.js'
import config from '../src/config/index.js'

describe('Authentication & Authorization Middlewares', () => {
  describe('authenticate middleware', () => {
    it('rejects requests with missing Authorization header', (t, done) => {
      const req = { headers: {} }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        done()
      })
    })

    it('rejects non-Bearer Authorization headers', (t, done) => {
      const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        done()
      })
    })

    it('rejects empty Bearer token', (t, done) => {
      const req = { headers: { authorization: 'Bearer ' } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        done()
      })
    })

    it('rejects tokens with invalid signatures', (t, done) => {
      const req = { headers: { authorization: 'Bearer invalid.token.signature' } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'INVALID_TOKEN')
        done()
      })
    })

    it('rejects expired tokens with TOKEN_EXPIRED', async () => {
      const expiredToken = signToken({ userId: 'usr-001', role: ROLES.INDIVIDUAL }, '0s')
      await new Promise((resolve) => setTimeout(resolve, 50))

      const req = { headers: { authorization: `Bearer ${expiredToken}` } }
      const res = {}

      await new Promise((resolve) => {
        authenticate(req, res, (err) => {
          assert.ok(err)
          assert.equal(err.statusCode, 401)
          assert.equal(err.code, 'TOKEN_EXPIRED')
          resolve()
        })
      })
    })

    it('rejects tokens with signed but invalid claims (e.g. unrecognized role)', (t, done) => {
      // Manually sign a token that bypassed signToken with an unrecognized role
      const invalidClaimsToken = jwt.sign(
        { userId: 'usr-001', role: 'unrecognized_hacker_role' },
        config.auth.jwtSecret,
        { algorithm: 'HS256' }
      )

      const req = { headers: { authorization: `Bearer ${invalidClaimsToken}` } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'INVALID_TOKEN')
        assert.match(err.message, /claims verification failed/)
        done()
      })
    })

    it('rejects tokens with non-string userId claim', (t, done) => {
      const invalidUserIdToken = jwt.sign(
        { userId: 12345, role: ROLES.INDIVIDUAL },
        config.auth.jwtSecret,
        { algorithm: 'HS256' }
      )

      const req = { headers: { authorization: `Bearer ${invalidUserIdToken}` } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'INVALID_TOKEN')
        done()
      })
    })

    it('attaches verified { userId, role } to req.user for valid token', (t, done) => {
      const validToken = signToken({ userId: 'usr-officer-99', role: ROLES.OFFICER })
      const req = { headers: { authorization: `Bearer ${validToken}` } }
      const res = {}

      authenticate(req, res, (err) => {
        assert.equal(err, undefined)
        assert.ok(req.user)
        assert.equal(req.user.userId, 'usr-officer-99')
        assert.equal(req.user.role, ROLES.OFFICER)
        done()
      })
    })
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
      const res = {}

      authMiddleware(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        done()
      })
    })

    it('denies user whose role is not in allowedRoles (403 FORBIDDEN)', (t, done) => {
      const authMiddleware = authorize(ROLES.OFFICER, ROLES.ADMIN)
      const req = { user: { userId: 'usr-citizen-1', role: ROLES.INDIVIDUAL } }
      const res = {}

      authMiddleware(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 403)
        assert.equal(err.code, 'FORBIDDEN')
        done()
      })
    })

    it('denies officer from accessing admin-only endpoint (403 FORBIDDEN)', (t, done) => {
      const authMiddleware = authorize(ROLES.ADMIN)
      const req = { user: { userId: 'usr-officer-1', role: ROLES.OFFICER } }
      const res = {}

      authMiddleware(req, res, (err) => {
        assert.ok(err)
        assert.equal(err.statusCode, 403)
        assert.equal(err.code, 'FORBIDDEN')
        done()
      })
    })

    it('allows user with matching role to proceed', (t, done) => {
      const authMiddleware = authorize(ROLES.OFFICER, ROLES.ADMIN)
      const req = { user: { userId: 'usr-officer-1', role: ROLES.OFFICER } }
      const res = {}

      authMiddleware(req, res, (err) => {
        assert.equal(err, undefined)
        done()
      })
    })

    it('allows admin to proceed on admin-only route', (t, done) => {
      const authMiddleware = authorize(ROLES.ADMIN)
      const req = { user: { userId: 'usr-admin-1', role: ROLES.ADMIN } }
      const res = {}

      authMiddleware(req, res, (err) => {
        assert.equal(err, undefined)
        done()
      })
    })
  })
})
