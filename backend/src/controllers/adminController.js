import * as officerRepo from '../repositories/officerRepository.js'
import * as userRepo from '../repositories/userRepository.js'
import { sendSuccess } from '../utils/response.js'

/**
 * GET /api/admin/officers
 * Returns paginated list of officers with:
 * name, email, badge, district, active, workload
 */
export async function listOfficers(req, res, next) {
  try {
    const { page = 1, limit = 20, pageSize, q, query } = req.query
    const effectiveLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20)))
    const effectivePage = Math.max(1, Math.trunc(Number(page) || 1))

    const officers = await officerRepo.listOfficersWithWorkload({
      page: effectivePage,
      limit: effectiveLimit,
      q: q || query || '',
    })

    const meta = {
      total: officers.total ?? officers.length,
      page: officers.page ?? effectivePage,
      limit: officers.limit ?? effectiveLimit,
      totalPages: officers.totalPages ?? 1,
    }

    return sendSuccess(res, officers, 200, 'Officers retrieved successfully', meta)
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/admin/users
 * Returns paginated list of users.
 * NEVER selects or returns password_hash.
 */
export async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, pageSize, q, query, role } = req.query
    const effectiveLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20)))
    const effectivePage = Math.max(1, Math.trunc(Number(page) || 1))

    const users = await userRepo.listUsers({
      page: effectivePage,
      limit: effectiveLimit,
      q: q || query || '',
      role: role || '',
    })

    const meta = {
      total: users.total ?? users.length,
      page: users.page ?? effectivePage,
      limit: users.limit ?? effectiveLimit,
      totalPages: users.totalPages ?? 1,
    }

    return sendSuccess(res, users, 200, 'Users retrieved successfully', meta)
  } catch (error) {
    return next(error)
  }
}

