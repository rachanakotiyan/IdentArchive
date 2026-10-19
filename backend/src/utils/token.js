import { z } from 'zod'
import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import { ALL_ROLES } from '../config/roles.js'

/**
 * Shared strict validation schema for JWT token claims.
 * - userId: required non-empty string
 * - role: required, must match one of existing ALL_ROLES values
 * - passthrough: preserves standard JWT claims like iat and exp
 */
export const tokenClaimsSchema = z.object({
  userId: z.string({
    required_error: 'userId is required',
    invalid_type_error: 'userId must be a string',
  }).trim().min(1, 'userId must be a non-empty string'),
  role: z.enum(ALL_ROLES, {
    errorMap: () => ({ message: `role must be one of: ${ALL_ROLES.join(', ')}` }),
  }),
}).passthrough()

/**
 * Generate a signed JWT bearer token.
 * Validates payload claims prior to signing.
 *
 * @param {object} payload - Token claims (requires userId and role)
 * @param {string} [expiresIn] - Optional custom expiration duration
 * @returns {string} Signed JWT token string
 */
export const signToken = (payload, expiresIn = config.auth.jwtExpiresIn) => {
  const result = tokenClaimsSchema.safeParse(payload)
  if (!result.success) {
    const errorMessages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid token payload: ${errorMessages}`)
  }

  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn,
    algorithm: 'HS256',
  })
}

/**
 * Verify and decode a JWT bearer token.
 * Enforces HS256 algorithm and expiration validation.
 *
 * @param {string} token - Raw JWT token string
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
  tokenClaimsSchema,
  signToken,
  verifyToken,
}
