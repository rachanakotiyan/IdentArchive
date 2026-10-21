import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import {
  getMatchesQueue,
  getMatchById,
  verifyMatch,
} from '../controllers/matchController.js'

const router = Router()

// Guard against unauthenticated callers if mounted directly without parent middleware
router.use((req, res, next) => {
  if (req.user && ['officer', 'admin'].includes(req.user.role)) {
    return next()
  }
  return authenticate(req, res, (err) => {
    if (err) return next(err)
    return authorize('officer', 'admin')(req, res, next)
  })
})

router.get('/', getMatchesQueue)
router.get('/:matchId', getMatchById)
router.post('/:matchId/verify', verifyMatch)

export default router
