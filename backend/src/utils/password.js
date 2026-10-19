import bcrypt from 'bcryptjs'

const BCRYPT_SALT_ROUNDS = 12

/**
 * Hash a plaintext password using bcrypt.
 *
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Salted bcrypt password hash
 */
export const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string')
  }
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 *
 * @param {string} password - Plaintext password
 * @param {string} hash - Stored bcrypt hash
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export const verifyPassword = async (password, hash) => {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false
  }
  return bcrypt.compare(password, hash)
}

export default {
  hashPassword,
  verifyPassword,
}
