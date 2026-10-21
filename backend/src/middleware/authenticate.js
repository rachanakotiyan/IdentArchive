import jwt from 'jsonwebtoken'
import { verifyToken, tokenClaimsSchema } from '../utils/token.js'
import { AppError } from '../utils/errors.js'
import * as userRepo from '../repositories/userRepository.js'
import * as officerRepo from '../repositories/officerRepository.js'

/**
 * Authentication middleware.
 *
 * 1. Verifies the Bearer JWT.
 * 2. Loads the user from MySQL on every request (M3 requirement).
 * 3. Rejects if the user no longer exists.
 * 4. For officers, rejects if officers.active = 0.
 * 5. Sets req.user with the DB-sourced { userId, role }.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next(new AppError('Authentication required. Missing Authorization header.', 401, 'UNAUTHORIZED'))
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return next(new AppError('Invalid Authorization header format. Expected "Bearer <token>".', 401, 'UNAUTHORIZED'))
  }

  const token = parts[1]

  let decoded
  try {
    decoded = verifyToken(token)
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Authentication token has expired.', 401, 'TOKEN_EXPIRED'))
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'))
    }
    return next(err)
  }

  const claimsResult = tokenClaimsSchema.safeParse(decoded)
  if (!claimsResult.success) {
    return next(new AppError('Invalid token payload: claims verification failed.', 401, 'INVALID_TOKEN'))
  }

  const userId = claimsResult.data.sub || claimsResult.data.userId

  // Load user from DB – reject if deleted since the token was issued
  let dbUser
  try {
    dbUser = await userRepo.findById(userId)
  } catch (err) {
    return next(err)
  }

  if (!dbUser) {
    return next(new AppError('User account not found.', 401, 'UNAUTHORIZED'))
  }

  // For officers: reject if deactivated
  if (dbUser.role === 'officer') {
    let officer
    try {
      officer = await officerRepo.findByUserId(userId)
    } catch (err) {
      return next(err)
    }
    if (!officer || !officer.active) {
      return next(new AppError('Officer account is deactivated.', 401, 'ACCOUNT_DEACTIVATED'))
    }
  }

  // Role comes from the DB, not the token, for M3 correctness
  req.user = {
    userId: dbUser.user_id,
    role: dbUser.role,
  }

  return next()
}

export default authenticate
