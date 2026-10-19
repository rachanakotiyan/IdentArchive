import { Router } from 'express'
import healthRouter from './health.js'

const apiRouter = Router()

apiRouter.use(healthRouter)

export default apiRouter
