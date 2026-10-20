import { getHealthStatus } from '../services/healthService.js'

export const getHealth = async (req, res, next) => {
  try {
    const health = await getHealthStatus()
    return res.status(200).json(health)
  } catch (error) {
    next(error)
  }
}

export default {
  getHealth,
}
