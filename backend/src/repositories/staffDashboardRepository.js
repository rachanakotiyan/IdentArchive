import pool from '../config/database.js'

export async function getStaffDashboardData({ user, officerId }) {
  const isOfficer = user?.role === 'officer'
  const offId = isOfficer ? officerId : null

  // 1. Reports by status
  let reportWhere = ''
  const reportParams = []
  if (isOfficer) {
    if (offId) {
      reportWhere = 'WHERE (r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL)'
      reportParams.push(offId)
    } else {
      reportWhere = 'WHERE r.assigned_officer_id IS NULL'
    }
  }

  const [reportStatusRows] = await pool.execute(
    `SELECT r.status, COUNT(*) AS cnt
     FROM reports r
     ${reportWhere}
     GROUP BY r.status`,
    reportParams
  )

  const reportsByStatus = {
    submitted: 0,
    under_review: 0,
    info_requested: 0,
    approved: 0,
    rejected: 0,
    closed: 0,
  }
  for (const row of reportStatusRows) {
    if (row.status in reportsByStatus) {
      reportsByStatus[row.status] = Number(row.cnt)
    }
  }

  // 2. Cases by status
  let caseWhere = ''
  const caseParams = []
  if (isOfficer) {
    if (offId) {
      caseWhere = 'WHERE (r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL OR r.case_id IS NULL)'
      caseParams.push(offId)
    } else {
      caseWhere = 'WHERE (r.assigned_officer_id IS NULL OR r.case_id IS NULL)'
    }
  }

  const [caseStatusRows] = await pool.execute(
    `SELECT c.case_status, COUNT(*) AS cnt
     FROM cases c
     LEFT JOIN reports r ON r.case_id = c.case_id
     ${caseWhere}
     GROUP BY c.case_status`,
    caseParams
  )

  const casesByStatusMap = {
    open: 0,
    under_review: 0,
    resolved: 0,
    closed: 0,
  }
  for (const row of caseStatusRows) {
    if (row.case_status in casesByStatusMap) {
      casesByStatusMap[row.case_status] = Number(row.cnt)
    }
  }

  const casesByStatusList = [
    { status: 'Open', count: casesByStatusMap.open, color: 'var(--accent)' },
    { status: 'Under Review', count: casesByStatusMap.under_review, color: 'var(--warning)' },
    { status: 'Resolved', count: casesByStatusMap.resolved, color: 'var(--success)' },
    { status: 'Closed', count: casesByStatusMap.closed, color: 'var(--muted)' },
  ]

  // 3. Pending matches count
  let pendingMatches = 0
  if (isOfficer) {
    if (offId) {
      const [matchRows] = await pool.execute(
        `SELECT COUNT(DISTINCT m.match_id) AS cnt
         FROM matches m
         LEFT JOIN reports rm ON rm.case_id = m.missing_case_id
         LEFT JOIN reports rf ON rf.case_id = m.found_case_id
         WHERE m.status = 'pending'
           AND (rm.assigned_officer_id = ? OR rf.assigned_officer_id = ? OR (rm.assigned_officer_id IS NULL AND rf.assigned_officer_id IS NULL))`,
        [offId, offId]
      )
      pendingMatches = Number(matchRows[0]?.cnt || 0)
    } else {
      const [matchRows] = await pool.execute(
        `SELECT COUNT(DISTINCT m.match_id) AS cnt
         FROM matches m
         LEFT JOIN reports rm ON rm.case_id = m.missing_case_id
         LEFT JOIN reports rf ON rf.case_id = m.found_case_id
         WHERE m.status = 'pending'
           AND (rm.assigned_officer_id IS NULL AND rf.assigned_officer_id IS NULL)`
      )
      pendingMatches = Number(matchRows[0]?.cnt || 0)
    }
  } else {
    const [matchRows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM matches WHERE status = 'pending'"
    )
    pendingMatches = Number(matchRows[0]?.cnt || 0)
  }

  // 4. My items
  const myItems = {
    reports: 0,
    cases: 0,
    pendingMatches: 0,
  }

  if (isOfficer && offId) {
    const [myRepRows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM reports
       WHERE assigned_officer_id = ?
         AND status IN ('submitted', 'under_review', 'info_requested')`,
      [offId]
    )
    myItems.reports = Number(myRepRows[0]?.cnt || 0)

    const [myCaseRows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM cases c
       JOIN reports r ON r.case_id = c.case_id
       WHERE r.assigned_officer_id = ?
         AND c.case_status IN ('open', 'under_review')`,
      [offId]
    )
    myItems.cases = Number(myCaseRows[0]?.cnt || 0)

    const [myMatchRows] = await pool.execute(
      `SELECT COUNT(DISTINCT m.match_id) AS cnt
       FROM matches m
       LEFT JOIN reports rm ON rm.case_id = m.missing_case_id
       LEFT JOIN reports rf ON rf.case_id = m.found_case_id
       WHERE m.status = 'pending'
         AND (rm.assigned_officer_id = ? OR rf.assigned_officer_id = ?)`,
      [offId, offId]
    )
    myItems.pendingMatches = Number(myMatchRows[0]?.cnt || 0)
  } else if (!isOfficer) {
    myItems.reports = reportsByStatus.submitted + reportsByStatus.under_review + reportsByStatus.info_requested
    myItems.cases = casesByStatusMap.open + casesByStatusMap.under_review
    myItems.pendingMatches = pendingMatches
  }

  // 5. Recent activity (last 10 events from report_history)
  let activityWhere = ''
  const activityParams = []
  if (isOfficer) {
    if (offId) {
      activityWhere = 'WHERE (r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL)'
      activityParams.push(offId)
    } else {
      activityWhere = 'WHERE r.assigned_officer_id IS NULL'
    }
  }

  const [activityRows] = await pool.execute(
    `SELECT rh.id, rh.event, rh.actor_id, rh.created_at, rh.report_id,
            r.reference_no, r.report_type,
            u.name AS actor_name
     FROM report_history rh
     JOIN reports r ON r.report_id = rh.report_id
     LEFT JOIN users u ON u.user_id = rh.actor_id
     ${activityWhere}
     ORDER BY rh.created_at DESC, rh.id DESC
     LIMIT 10`,
    activityParams
  )

  const recentActivity = activityRows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    referenceNo: row.reference_no,
    reportType: row.report_type,
    event: row.event,
    actorId: row.actor_id,
    actorName: row.actor_name || 'System',
    date: row.created_at,
    createdAt: row.created_at,
  }))

  // 6. Reports per week for the last 8 weeks
  const now = new Date()
  const weekBuckets = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (i * 7)))
    const year = d.getUTCFullYear()
    const oneJan = new Date(Date.UTC(year, 0, 1))
    const weekNum = Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getUTCDay() + 1) / 7)
    weekBuckets.push({
      week: `W${String(weekNum).padStart(2, '0')}`,
      startDate: d.toISOString().slice(0, 10),
      count: 0,
      timestamp: d.getTime(),
    })
  }

  let weekWhere = 'WHERE r.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 56 DAY)'
  const weekParams = []
  if (isOfficer) {
    if (offId) {
      weekWhere += ' AND (r.assigned_officer_id = ? OR r.assigned_officer_id IS NULL)'
      weekParams.push(offId)
    } else {
      weekWhere += ' AND r.assigned_officer_id IS NULL'
    }
  }

  const [weekRows] = await pool.execute(
    `SELECT DATE(r.created_at) AS report_date, COUNT(*) AS cnt
     FROM reports r
     ${weekWhere}
     GROUP BY DATE(r.created_at)`,
    weekParams
  )

  for (const row of weekRows) {
    const rowTime = new Date(row.report_date).getTime()
    // Find matching bucket
    for (let j = weekBuckets.length - 1; j >= 0; j--) {
      if (rowTime >= weekBuckets[j].timestamp) {
        weekBuckets[j].count += Number(row.cnt)
        break
      }
    }
  }

  const reportsPerWeek = weekBuckets.map(({ week, startDate, count }) => ({ week, startDate, count }))

  // 7. Extra summary metrics matching frontend staffService
  let unassignedWhere = "WHERE r.assigned_officer_id IS NULL AND r.status NOT IN ('rejected', 'closed')"
  const [unassignedRows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM reports r ${unassignedWhere}`
  )
  const unassigned = Number(unassignedRows[0]?.cnt || 0)

  const totalCases = casesByStatusMap.open + casesByStatusMap.under_review + casesByStatusMap.resolved + casesByStatusMap.closed
  const resolvedCases = casesByStatusMap.resolved

  return {
    reportsByStatus,
    casesByStatus: casesByStatusMap,
    casesByStatusList,
    pendingMatches,
    awaitingReview: reportsByStatus.submitted,
    infoRequested: reportsByStatus.info_requested,
    unassigned,
    totalCases,
    resolvedCases,
    myItems,
    recentActivity,
    reportsPerWeek,
    reportsOverTime: reportsPerWeek,
  }
}

