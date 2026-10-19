import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from '../src/utils/password.js'

describe('Password Utilities', () => {
  it('hashPassword generates a valid bcrypt hash starting with $2a$ or $2b$', async () => {
    const password = 'CorrectHorseBatteryStaple123!'
    const hash = await hashPassword(password)

    assert.equal(typeof hash, 'string')
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'))
  })

  it('hashPassword applies unique random salt per invocation', async () => {
    const password = 'SamePasswordEveryTime123!'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    assert.notEqual(hash1, hash2)
  })

  it('verifyPassword returns true for matching plaintext and hash', async () => {
    const password = 'MySecureSecretPassword!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)

    assert.equal(isValid, true)
  })

  it('verifyPassword returns false for non-matching plaintext', async () => {
    const password = 'RealPassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('IncorrectPassword999!', hash)

    assert.equal(isValid, false)
  })

  it('verifyPassword safely returns false on empty or non-string inputs without throwing', async () => {
    const validHash = await hashPassword('ValidPassword123!')

    assert.equal(await verifyPassword('', validHash), false)
    assert.equal(await verifyPassword(null, validHash), false)
    assert.equal(await verifyPassword(undefined, validHash), false)
    assert.equal(await verifyPassword('ValidPassword123!', ''), false)
    assert.equal(await verifyPassword('ValidPassword123!', null), false)
    assert.equal(await verifyPassword('ValidPassword123!', undefined), false)
    assert.equal(await verifyPassword(12345, validHash), false)
  })

  it('hashPassword rejects empty or non-string inputs with a descriptive error', async () => {
    await assert.rejects(async () => {
      await hashPassword('')
    }, /Password must be a non-empty string/)

    await assert.rejects(async () => {
      await hashPassword(null)
    }, /Password must be a non-empty string/)

    await assert.rejects(async () => {
      await hashPassword(12345)
    }, /Password must be a non-empty string/)
  })
})
