import express from 'express'
import helmet from 'helmet'
import corsMiddleware from './middleware/cors.js'
import requestLogger from './middleware/requestLogger.js'
import healthRouter from './routes/health.js'
import notFoundHandler from './middleware/notFoundHandler.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

app.use(helmet())
app.use(corsMiddleware)
app.use(requestLogger)
app.use(express.json({ limit: '1mb' }))

app.use('/api', healthRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
