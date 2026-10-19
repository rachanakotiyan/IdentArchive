/**
 * Application User Roles
 *
 * Derived from FRONTEND_BRIEF.md and system design:
 * - individual: Public citizen reporting or tracking a missing/found person.
 * - officer: Case reviewer and investigator.
 * - admin: System administrator managing officers, users, and configuration.
 */
export const ROLES = Object.freeze({
  INDIVIDUAL: 'individual',
  OFFICER: 'officer',
  ADMIN: 'admin',
})

export const ALL_ROLES = Object.freeze(Object.values(ROLES))

export default ROLES
