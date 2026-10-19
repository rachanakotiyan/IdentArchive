import { AppError } from '../utils/errors.js'

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
      },
    })
  }

  // Handle known operational application errors
  if (err instanceof AppError || err.isOperational) {
    const errorPayload = {
      code: err.code || 'BAD_REQUEST',
      message: err.message || 'An error occurred',
    }

    if (err.details !== undefined) {
      errorPayload.details = err.details
    }

    return res.status(err.statusCode || 400).json({
      success: false,
      error: errorPayload,
    })
  }

  // Unexpected server error: log on server, return generic 500 to client
  console.error('Unhandled server error:', err)

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred on the server',
    },
  })
}

export default errorHandler
