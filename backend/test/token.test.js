import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken, tokenClaimsSchema } from '../src/utils/token.js'
import { ROLES, ALL_ROLES } from '../src/config/roles.js'

describe('JWT Token Utilities & Claim Validation', () => {
  it('tokenClaimsSchema validates valid claims for all recognized roles', () => {
    for (const role of ALL_ROLES) {
      const result = tokenClaimsSchema.safeParse({ userId: 'usr-001', role })
      assert.equal(result.success, true)
      assert.equal(result.data.userId, 'usr-001')
      assert.equal(result.data.role, role)
    }
  })

  it('tokenClaimsSchema rejects empty, whitespace, or non-string userId', () => {
    const emptyResult = tokenClaimsSchema.safeParse({ userId: '', role: ROLES.INDIVIDUAL })
    assert.equal(emptyResult.success, false)

    const whitespaceResult = tokenClaimsSchema.safeParse({ userId: '   ', role: ROLES.INDIVIDUAL })
    assert.equal(whitespaceResult.success, false)

    const numberResult = tokenClaimsSchema.safeParse({ userId: 123, role: ROLES.INDIVIDUAL })
    assert.equal(numberResult.success, false)
  })

  it('tokenClaimsSchema rejects unknown or empty roles', () => {
    const unknownResult = tokenClaimsSchema.safeParse({ userId: 'usr-001', role: 'superadmin' })
    assert.equal(unknownResult.success, false)

    const emptyRoleResult = tokenClaimsSchema.safeParse({ userId: 'usr-001', role: '' })
    assert.equal(emptyRoleResult.success, false)
  })

  it('signToken produces a valid 3-part JWT for valid claims', () => {
    const token = signToken({ userId: 'usr-001', role: ROLES.OFFICER })
    assert.equal(typeof token, 'string')
    assert.equal(token.split('.').length, 3)
  })

  it('signToken rejects invalid claims before signing', () => {
    assert.throws(() => {
      signToken({ userId: '', role: ROLES.OFFICER })
    }, /Invalid token payload/)

    assert.throws(() => {
      signToken({ userId: 'usr-001', role: 'invalid_role' })
    }, /Invalid token payload/)

    assert.throws(() => {
      signToken({ role: ROLES.OFFICER })
    }, /Invalid token payload/)
  })

  it('verifyToken correctly decodes payload claims and preserves timestamps', () => {
    const token = signToken({ userId: 'usr-002', role: ROLES.ADMIN })
    const decoded = verifyToken(token)

    assert.equal(decoded.userId, 'usr-002')
    assert.equal(decoded.role, ROLES.ADMIN)
    assert.equal(typeof decoded.iat, 'number')
    assert.equal(typeof decoded.exp, 'number')
  })

  it('verifyToken rejects tampered tokens', () => {
    const token = signToken({ userId: 'usr-001', role: ROLES.INDIVIDUAL })
    const parts = token.split('.')
    // Tamper with payload to elevate role to admin
    parts[1] = Buffer.from(JSON.stringify({ userId: 'usr-001', role: ROLES.ADMIN })).toString('base64url')
    const tampered = parts.join('.')

    assert.throws(() => {
      verifyToken(tampered)
    }, { name: 'JsonWebTokenError' })
  })

  it('verifyToken rejects expired tokens', async () => {
    const expiredToken = signToken({ userId: 'usr-001', role: ROLES.INDIVIDUAL }, '0s')
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.throws(() => {
      verifyToken(expiredToken)
    }, { name: 'TokenExpiredError' })
  })

  it('verifyToken rejects tokens signed with wrong algorithm', () => {
    // Attempt none algorithm attack
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ userId: 'usr-001', role: ROLES.ADMIN })).toString('base64url')
    const unsignedToken = `${header}.${payload}.`

    assert.throws(() => {
      verifyToken(unsignedToken)
    }, { name: 'JsonWebTokenError' })
  })

  it('verifyToken rejects tokens signed with a different secret', () => {
    const foreignToken = jwt.sign({ userId: 'usr-001', role: ROLES.ADMIN }, 'wrong_secret_12345678901234567890', {
      algorithm: 'HS256',
    })

    assert.throws(() => {
      verifyToken(foreignToken)
    }, { name: 'JsonWebTokenError' })
  })
})
