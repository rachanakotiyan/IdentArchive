import pool from '../config/database.js'

export const createReport = async (reportData, userId = null) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Insert report with temporary reference number
    const [result] = await connection.query(
      `INSERT INTO reports (
        user_id, report_type, subject_name, age, gender, 
        last_seen_location, description, contact_email, 
        contact_phone, tracking_pin, reference_no, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TEMP', 'PENDING')`,
      [
        userId,
        reportData.report_type,
        reportData.subject_name,
        reportData.age || null,
        reportData.gender || null,
        reportData.last_seen_location || null,
        reportData.description || null,
        reportData.contact_email,
        reportData.contact_phone || null,
        reportData.tracking_pin,
      ]
    );

    const reportId = result.insertId;

    // 2. Format final reference number: REF-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const referenceNo = `REF-${dateStr}-${String(reportId).padStart(4, '0')}`;

    // 3. Update report with formatted reference_no in same transaction
    await connection.query(
      `UPDATE reports SET reference_no = ? WHERE report_id = ?`,
      [referenceNo, reportId]
    );

    await connection.commit();

    // 4. Return created record
    const [rows] = await pool.query(
      `SELECT report_id, reference_no, report_type, subject_name, status, created_at 
       FROM reports WHERE report_id = ?`,
      [reportId]
    );

    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getReportsByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT report_id, reference_no, report_type, subject_name, status, created_at 
     FROM reports WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
};

export const getReportByRefAndPin = async (referenceNo, pin) => {
  const [rows] = await pool.query(
    `SELECT reference_no, report_type, subject_name, status, created_at, updated_at 
     FROM reports WHERE reference_no = ? AND tracking_pin = ?`,
    [referenceNo, pin]
  );
  return rows[0] || null;
};