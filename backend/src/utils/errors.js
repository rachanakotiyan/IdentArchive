export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = undefined) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    if (details !== undefined) {
      this.details = details
    }
  }
}

export default AppError
