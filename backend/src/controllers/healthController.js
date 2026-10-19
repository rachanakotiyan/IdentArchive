import { getHealthStatus } from '../services/healthService.js'

export const getHealth = (req, res) => {
  const health = getHealthStatus()
  return res.status(200).json(health)
}

export default {
  getHealth,
}
