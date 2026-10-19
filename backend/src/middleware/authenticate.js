import jwt from 'jsonwebtoken'
import { verifyToken, tokenClaimsSchema } from '../utils/token.js'
import { AppError } from '../utils/errors.js'

/**
 * Authentication middleware for verifying JWT Bearer tokens in Authorization header.
 *
 * Verifies that:
 * 1. An Authorization header is present.
 * 2. It follows the "Bearer <token>" format.
 * 3. The token signature is valid and has not expired.
 * 4. Token payload strictly satisfies tokenClaimsSchema (valid userId and recognized role).
 *
 * Populates req.user with verified { userId, role } on success.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next(new AppError('Authentication required. Missing Authorization header.', 401, 'UNAUTHORIZED'))
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return next(new AppError('Invalid Authorization header format. Expected "Bearer <token>".', 401, 'UNAUTHORIZED'))
  }

  const token = parts[1]

  try {
    const decoded = verifyToken(token)

    const claimsResult = tokenClaimsSchema.safeParse(decoded)
    if (!claimsResult.success) {
      return next(new AppError('Invalid token payload: claims verification failed.', 401, 'INVALID_TOKEN'))
    }

    req.user = {
      userId: claimsResult.data.userId,
      role: claimsResult.data.role,
    }

    return next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Authentication token has expired.', 401, 'TOKEN_EXPIRED'))
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'))
    }

    return next(err)
  }
}

export default authenticate
