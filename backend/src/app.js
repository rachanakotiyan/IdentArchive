import express from 'express'
import helmet from 'helmet'
import corsMiddleware from './middleware/cors.js'
import requestLogger from './middleware/requestLogger.js'
import apiRouter from './routes/index.js'
import notFoundHandler from './middleware/notFoundHandler.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

// Configure trust proxy from TRUST_PROXY env var (number of proxy hops; default 0 = direct).
// Set to 1 when behind a single reverse proxy (e.g. nginx), 2 for two hops, etc.
// Required so express-rate-limit and req.ip see the real client IP, not the proxy IP.
const rawTrustProxy = process.env.TRUST_PROXY
const trustProxy = rawTrustProxy !== undefined
  ? (Number.isInteger(Number(rawTrustProxy)) ? Number(rawTrustProxy) : rawTrustProxy)
  : 0
app.set('trust proxy', trustProxy)

app.use(helmet())
app.use(corsMiddleware)
app.use(requestLogger)
app.use(express.json({ limit: '1mb' }))

app.use('/api', apiRouter)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
