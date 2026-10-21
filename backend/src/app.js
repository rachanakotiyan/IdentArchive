import express from 'express'
import helmet from 'helmet'
import corsMiddleware from './middleware/cors.js'
import requestLogger from './middleware/requestLogger.js'
import apiRouter from './routes/index.js'
import notFoundHandler from './middleware/notFoundHandler.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

app.use(helmet())
app.use(corsMiddleware)
app.use(requestLogger)
app.use(express.json({ limit: '1mb' }))

app.use('/api', apiRouter)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
