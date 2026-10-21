import { Router } from 'express'
import healthRouter from './health.js'
import authRouter from './auth.js'
import adminRouter from './admin.js'

const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/admin', adminRouter)

export default apiRouter
