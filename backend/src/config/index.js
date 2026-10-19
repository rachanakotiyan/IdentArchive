import 'dotenv/config'

const rawPort = process.env.PORT || '3000'
const parsedPort = Number(rawPort)

if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
  throw new Error(`Invalid PORT configuration: "${rawPort}". Must be a valid port number between 1 and 65535.`)
}

const nodeEnv = process.env.NODE_ENV || 'development'
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'

const allowedOrigins = rawCorsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (allowedOrigins.length === 0) {
  throw new Error('Invalid CORS_ORIGIN configuration: at least one origin must be specified.')
}

const rawJwtSecret = process.env.JWT_SECRET

if (!rawJwtSecret) {
  throw new Error('Missing required JWT_SECRET environment variable. Please define JWT_SECRET in your .env file.')
}

if (nodeEnv === 'production' && rawJwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long in production mode.')
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d'

export const config = Object.freeze({
  port: parsedPort,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  cors: {
    allowedOrigins,
  },
  auth: {
    jwtSecret: rawJwtSecret,
    jwtExpiresIn,
  },
})

export default config
