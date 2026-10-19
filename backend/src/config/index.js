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

export const config = Object.freeze({
  port: parsedPort,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  cors: {
    allowedOrigins,
  },
})

export default config
