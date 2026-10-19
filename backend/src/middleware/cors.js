import cors from 'cors'
import config from '../config/index.js'
import { AppError } from '../utils/errors.js'

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin requests with no origin header (e.g. curl, server-to-server)
    if (!origin) {
      return callback(null, true)
    }

    const isAllowed = config.cors.allowedOrigins.some((allowed) => {
      return allowed === '*' || allowed === origin
    })

    if (isAllowed) {
      return callback(null, true)
    }

    return callback(new AppError(`Origin ${origin} is not allowed by CORS`, 403, 'CORS_FORBIDDEN'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

export const corsMiddleware = cors(corsOptions)
export default corsMiddleware
