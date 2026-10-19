import { AppError } from '../utils/errors.js'

/**
 * Authorization middleware factory for role-based access control.
 *
 * Must be mounted after `authenticate` middleware in the route chain.
 *
 * @param {...string} allowedRoles - One or more roles allowed to access the route
 * @returns {import('express').RequestHandler}
 */
export const authorize = (...allowedRoles) => {
  if (allowedRoles.length === 0) {
    throw new Error('authorize middleware requires at least one allowed role')
  }

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('Authentication required before authorization.', 401, 'UNAUTHORIZED'))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to access this resource.', 403, 'FORBIDDEN'))
    }

    return next()
  }
}

export default authorize
