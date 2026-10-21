import crypto from 'node:crypto'
import { z } from 'zod'
import * as userRepo from '../repositories/userRepository.js'
import * as officerRepo from '../repositories/officerRepository.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/token.js'
import { AppError } from '../utils/errors.js'
import pool from '../config/database.js'

// A valid cost-12 hash keeps unknown-email login failures on the bcrypt path.
const DUMMY_HASH = '$2b$12$oEPGk8Zdb3GJ6vkil/fMbeMHZQKSjSrHBFBYis3wSWdFHmpgKTfBu'

// ---------------------------------------------------------------------------
// Validation schemas (internal to service – not public API contracts)
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  name: z.string({ required_error: 'name is required' }).trim().min(2, 'name must be at least 2 characters'),
  email: z.string({ required_error: 'email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'password is required' }).min(8, 'Password must be at least 8 characters'),
  phone: z.string().trim().optional(),
})

const loginSchema = z.object({
  email: z.string({ required_error: 'email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
})

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Register a new user with role='individual'.
 * Ignores any role field in input.
 *
 * @param {object} input - raw request body
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function register(input) {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }))
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
  }

  const { name, email, password, phone } = parsed.data
  const normalised = email.toLowerCase().trim()

  const taken = await userRepo.emailExists(normalised)
  if (taken) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT')
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  let user
  try {
    user = await userRepo.create({
      userId,
      name,
      email: normalised,
      passwordHash,
      role: 'individual',
      phone: phone || null,
      verifiedAt: null,
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT')
    }
    throw error
  }

  const token = signToken({ userId: user.user_id, sub: user.user_id, role: user.role })
  return { user, token }
}

/**
 * Authenticate a user by email + password.
 * Returns a generic error regardless of whether the email exists or the password is wrong.
 *
 * @param {object} input
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function login(input) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }))
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
  }

  const { email, password } = parsed.data
  const GENERIC_ERR = new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')

  // Always fetch with hash; if not found, compare against dummy to match timing
  const userWithHash = await userRepo.findByEmailWithHash(email)

  if (!userWithHash) {
    // Timing equalization: still run bcrypt.compare against a dummy hash
    await verifyPassword(password, DUMMY_HASH)
    throw GENERIC_ERR
  }

  const passwordOk = await verifyPassword(password, userWithHash.password_hash)
  if (!passwordOk) {
    throw GENERIC_ERR
  }

  // Return public fields only
  const { password_hash: _dropped, ...user } = userWithHash

  const token = signToken({ userId: user.user_id, sub: user.user_id, role: user.role })
  return { user, token }
}

/**
 * Get the current user's profile, including officer fields if applicable.
 * Never returns password_hash.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getMe(userId) {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('User not found.', 404, 'NOT_FOUND')
  }

  const profile = {
    id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || null,
  }

  if (user.role === 'officer') {
    const officer = await officerRepo.findByUserId(userId)
    if (officer) {
      profile.badge = officer.badge
      profile.district = officer.district
    }
  }

  return profile
}

// ---------------------------------------------------------------------------
// Admin-only staff provisioning
// ---------------------------------------------------------------------------

const createStaffSchema = z.object({
  name: z.string().trim().min(2, 'name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['officer', 'admin'], { errorMap: () => ({ message: 'role must be officer or admin' }) }),
  badge: z.string().trim().min(1).max(50).optional(),
  district: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().optional(),
})

const setOfficerActiveSchema = z.object({
  active: z.boolean(),
})

/**
 * Create a staff user (officer or admin) in a single transaction.
 * For 'officer' role, also creates the officers row.
 * On any error the whole transaction is rolled back.
 *
 * @param {object} input
 * @returns {Promise<{ user: object, officer?: object }>}
 */
export async function createStaff(input) {
  const parsed = createStaffSchema.safeParse(input)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }))
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
  }

  const { name, email, password, role, badge, district, phone } = parsed.data

  if (role === 'officer' && (!badge || !district)) {
    throw new AppError('badge and district are required for role officer.', 400, 'VALIDATION_ERROR')
  }

  const normalised = email.toLowerCase().trim()
  const userId = crypto.randomUUID()
  const officerId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    if (await userRepo.emailExists(normalised, conn)) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT')
    }

    const user = await userRepo.create(
      { userId, name, email: normalised, passwordHash, role, phone: phone || null, verifiedAt: new Date() },
      conn
    )

    let officer = null
    if (role === 'officer') {
      officer = await officerRepo.create({ officerId, userId, badge, district }, conn)
    }

    await conn.commit()
    return { user, officer }
  } catch (err) {
    try {
      await conn.rollback()
    } catch (rollbackError) {
      throw new AggregateError(
        [err, rollbackError],
        'Staff provisioning failed and the transaction could not be rolled back.'
      )
    }
    if (err.code === 'ER_DUP_ENTRY') {
      if (String(err.message).includes('uq_officers_badge')) {
        throw new AppError('A staff member with this badge already exists.', 409, 'BADGE_CONFLICT')
      }
      if (String(err.message).includes('uq_users_email')) {
        throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT')
      }
    }
    throw err
  } finally {
    conn.release()
  }
}

/**
 * List all staff members for admin view.
 * @returns {Promise<Array>}
 */
export async function listStaff() {
  return userRepo.listStaff()
}

/**
 * Deactivate or reactivate an officer by officer_id.
 *
 * @param {string} officerId
 * @param {boolean} active
 * @returns {Promise<void>}
 */
export async function setOfficerActive(officerId, active) {
  const parsed = setOfficerActiveSchema.safeParse({ active })
  if (!parsed.success) {
    throw new AppError('active must be a boolean.', 400, 'VALIDATION_ERROR')
  }

  const updated = await officerRepo.setActive(officerId, active ? 1 : 0)
  if (!updated) {
    throw new AppError('Officer not found.', 404, 'NOT_FOUND')
  }
}
