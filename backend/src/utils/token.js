import jwt from 'jsonwebtoken'
import config from '../config/index.js'

/**
 * Generate a signed JWT bearer token.
 *
 * @param {object} payload - Token claims (e.g., { userId, role })
 * @param {string} [expiresIn] - Optional custom expiration duration
 * @returns {string} Signed JWT token string
 */
export const signToken = (payload, expiresIn = config.auth.jwtExpiresIn) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Token payload must be an object')
  }

  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn,
    algorithm: 'HS256',
  })
}

/**
 * Verify and decode a JWT bearer token.
 *
 * @param {string} token - Raw JWT token
 * @returns {object} Decoded token payload
 * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError}
 */
export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string')
  }

  return jwt.verify(token, config.auth.jwtSecret, {
    algorithms: ['HS256'],
  })
}

export default {
  signToken,
  verifyToken,
}
