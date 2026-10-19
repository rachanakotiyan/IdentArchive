import { AppError } from '../utils/errors.js'

/**
 * Middleware factory for validating incoming request targets (body, query, params)
 * using Zod schemas.
 *
 * @param {import('zod').ZodType | { body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schema
 */
export const validate = (schema) => (req, res, next) => {
  const targets = schema.body || schema.query || schema.params
    ? { body: schema.body, query: schema.query, params: schema.params }
    : { body: schema }

  const details = []

  for (const [key, targetSchema] of Object.entries(targets)) {
    if (!targetSchema) continue

    const result = targetSchema.safeParse(req[key])
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? issue.path.join('.') : key
        details.push({
          field,
          message: issue.message,
        })
      }
    } else {
      if (key === 'body') {
        req.body = result.data
      } else {
        Object.defineProperty(req, key, {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        })
      }

      req.validated = req.validated || {}
      req.validated[key] = result.data
    }
  }

  if (details.length > 0) {
    return next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details))
  }

  return next()
}

export default validate
