import { getPool } from '../config/database.js';

/**
 * Retrieves submitted reports with optional status filtering.
 */
export const getStaffReportsQueue = async ({ status, page = 1, limit = 20 }) => {
  const pool = getPool();
  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [];

  let sql = `
    SELECT 
      r.report_id,
      r.reference_no,
      r.report_type,
      r.subject_name,
      r.age,
      r.gender,
      r.last_seen_location,
      r.contact_email,
      r.status,
      r.assigned_officer_id,
      r.created_at,
      r.updated_at
    FROM reports r
  `;

  if (status) {
    sql += ` WHERE r.status = ?`;
    queryParams.push(status);
  }

  sql += ` ORDER BY r.created_at ASC LIMIT ? OFFSET ?`;
  queryParams.push(Number(limit), Number(offset));

  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

/**
 * Assigns a report to an officer and sets status to UNDER_REVIEW.
 */
export const assignReportToOfficer = async (reportId, officerUserId) => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE reports 
     SET assigned_officer_id = ?, status = 'UNDER_REVIEW', updated_at = NOW()
     WHERE report_id = ? AND status IN ('PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED')`,
    [officerUserId, reportId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT report_id, reference_no, status, assigned_officer_id, updated_at 
     FROM reports WHERE report_id = ?`,
    [reportId]
  );
  return rows[0];
};

/**
 * Requests more information from reporter with audit note.
 */
export const requestMoreInfo = async (reportId, note) => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE reports 
     SET status = 'INFO_REQUESTED', 
         description = CONCAT(IFNULL(description, ''), '\n[INFO REQUEST]: ', ?),
         updated_at = NOW()
     WHERE report_id = ?`,
    [note, reportId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT report_id, reference_no, status, updated_at FROM reports WHERE report_id = ?`,
    [reportId]
  );
  return rows[0];
};

/**
 * Rejects a report with mandatory rejection reason.
 */
export const rejectReport = async (reportId, rejectionReason) => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE reports 
     SET status = 'REJECTED', 
         description = CONCAT(IFNULL(description, ''), '\n[REJECTION REASON]: ', ?),
         updated_at = NOW()
     WHERE report_id = ? AND status != 'APPROVED'`,
    [rejectionReason, reportId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT report_id, reference_no, status, updated_at FROM reports WHERE report_id = ?`,
    [reportId]
  );
  return rows[0];
};

/**
 * Atomically approves a report and creates the corresponding case.
 * Runs inside a single MySQL transaction.
 */
export const approveReportAndCreateCase = async (reportId, caseData = {}) => {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and verify the report
    const [reportRows] = await connection.query(
      `SELECT * FROM reports WHERE report_id = ? FOR UPDATE`,
      [reportId]
    );

    if (reportRows.length === 0) {
      await connection.rollback();
      return null;
    }

    const report = reportRows[0];

    if (report.status === 'APPROVED') {
      await connection.rollback();
      const error = new Error('Report is already approved');
      error.code = 'ALREADY_APPROVED';
      throw error;
    }

    // 2. Insert new case with temporary placeholder case_number
    const caseType = caseData.case_type || (report.report_type === 'MISSING' ? 'MISSING' : 'FOUND');
    const title = caseData.title || `Case for ${report.subject_name}`;

    const [caseResult] = await connection.query(
      `INSERT INTO cases (
        case_number, case_type, title, subject_name, age, gender, 
        last_known_location, description, status, created_at, updated_at
      ) VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, 'OPEN', NOW(), NOW())`,
      [
        caseType,
        title,
        report.subject_name,
        report.age || null,
        report.gender || null,
        report.last_seen_location || null,
        report.description || null
      ]
    );

    const caseId = caseResult.insertId;

    // 3. Format final case_number (e.g. CASE-YYYYMMDD-XXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const caseNumber = `CASE-${dateStr}-${String(caseId).padStart(4, '0')}`;

    // 4. Update case with final formatted case_number
    await connection.query(
      `UPDATE cases SET case_number = ? WHERE case_id = ?`,
      [caseNumber, caseId]
    );

    // 5. Update report to APPROVED and link created case_id
    await connection.query(
      `UPDATE reports 
       SET status = 'APPROVED', case_id = ?, updated_at = NOW() 
       WHERE report_id = ?`,
      [caseId, reportId]
    );

    await connection.commit();

    // 6. Fetch created case record
    const [newCaseRows] = await pool.query(
      `SELECT * FROM cases WHERE case_id = ?`,
      [caseId]
    );

    return {
      report_id: reportId,
      case: newCaseRows[0]
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};