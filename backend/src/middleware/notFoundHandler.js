import { AppError } from '../utils/errors.js'

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'))
}

export default notFoundHandler
