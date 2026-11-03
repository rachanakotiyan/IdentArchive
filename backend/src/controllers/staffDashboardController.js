import * as dashboardRepo from '../repositories/staffDashboardRepository.js'
import * as officerRepo from '../repositories/officerRepository.js'
import { sendSuccess } from '../utils/response.js'

export const getDashboard = async (req, res, next) => {
  try {
    let officer = null
    if (req.user?.role === 'officer') {
      officer = await officerRepo.findByUserId(req.user.userId)
    }

    const data = await dashboardRepo.getStaffDashboardData({
      user: req.user,
      officerId: officer?.officer_id,
    })

    return sendSuccess(res, data, 200, 'Staff dashboard data retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

