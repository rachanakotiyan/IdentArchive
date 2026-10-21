import { sendSuccess } from '../utils/response.js'
import * as authService from '../services/authService.js'

/**
 * POST /api/auth/register
 * Registers a new user with role='individual'.
 */
export async function register(req, res, next) {
  try {
    const { user, token } = await authService.register(req.body)
    return sendSuccess(res, { user, token }, 201, 'Account created successfully.')
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { user, token } = await authService.login(req.body)
    return sendSuccess(res, { user, token }, 200, 'Login successful.')
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/auth/me  (requires authenticate middleware)
 */
export async function me(req, res, next) {
  try {
    const profile = await authService.getMe(req.user.userId)
    return sendSuccess(res, { user: profile })
  } catch (err) {
    return next(err)
  }
}

// ---------------------------------------------------------------------------
// Admin staff controller
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/staff
 */
export async function createStaff(req, res, next) {
  try {
    const result = await authService.createStaff(req.body)
    return sendSuccess(res, result, 201, 'Staff member created.')
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/admin/staff
 */
export async function listStaff(req, res, next) {
  try {
    const staff = await authService.listStaff()
    return sendSuccess(res, { staff })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /api/admin/staff/:id/active
 * Body: { active: boolean }
 */
export async function setOfficerActive(req, res, next) {
  try {
    const { id } = req.params
    const active = req.body?.active
    await authService.setOfficerActive(id, active)
    return sendSuccess(res, { officerId: id, active }, 200, `Officer ${active ? 'activated' : 'deactivated'}.`)
  } catch (err) {
    return next(err)
  }
}
