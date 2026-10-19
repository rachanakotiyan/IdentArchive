import express from 'express'
import healthRouter from './routes/health.js'
import notFoundHandler from './middleware/notFoundHandler.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

app.use(express.json())
app.use('/api', healthRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
