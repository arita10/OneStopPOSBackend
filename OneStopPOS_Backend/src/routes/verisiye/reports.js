const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/verisiye/reports/daily
 * Get daily credit report
 */
router.get('/daily', asyncHandler(async (req, res) => {
  const { date } = req.query;
  const userId = req.user.id;

  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT
       COUNT(CASE WHEN type = 'credit' THEN 1 END) as credit_count,
       COUNT(CASE WHEN type = 'payment' THEN 1 END) as payment_count,
       COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credit,
       COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as total_payments,
       COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as net_credit
     FROM verisiye_transactions
     WHERE DATE(created_at) = $1 AND user_id = $2`,
    [targetDate, userId]
  );

  // Get transactions for the day
  const transactionsResult = await pool.query(
    `SELECT vt.*, vc.name as customer_name, vc.house_no as customer_house_no
     FROM verisiye_transactions vt
     JOIN verisiye_customers vc ON vt.customer_id = vc.id
     WHERE DATE(vt.created_at) = $1 AND vt.user_id = $2
     ORDER BY vt.created_at DESC`,
    [targetDate, userId]
  );

  res.json({
    date: targetDate,
    summary: result.rows[0],
    transactions: transactionsResult.rows
  });
}));

/**
 * GET /api/verisiye/reports/by-customer
 * Get credit report grouped by customer
 */
router.get('/by-customer', asyncHandler(async (req, res) => {
  const { house_no, name, start_date, end_date } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT
      vc.id,
      vc.name,
      vc.house_no,
      vc.phone,
      vc.current_balance,
      COALESCE(SUM(CASE WHEN vt.type = 'credit' THEN vt.amount ELSE 0 END), 0) as total_credit,
      COALESCE(SUM(CASE WHEN vt.type = 'payment' THEN vt.amount ELSE 0 END), 0) as total_payments,
      COUNT(vt.id) as transaction_count,
      MAX(vt.created_at) as last_transaction_date
    FROM verisiye_customers vc
    LEFT JOIN verisiye_transactions vt ON vc.id = vt.customer_id
  `;

  const params = [userId];
  let paramCount = 1;
  const conditions = ['vc.is_active = true', 'vc.user_id = $1'];

  if (house_no) {
    paramCount++;
    conditions.push(`vc.house_no ILIKE $${paramCount}`);
    params.push(`%${house_no}%`);
  }

  if (name) {
    paramCount++;
    conditions.push(`vc.name ILIKE $${paramCount}`);
    params.push(`%${name}%`);
  }

  if (start_date) {
    paramCount++;
    conditions.push(`(vt.created_at IS NULL OR vt.created_at >= $${paramCount})`);
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    conditions.push(`(vt.created_at IS NULL OR vt.created_at <= $${paramCount})`);
    params.push(end_date);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += `
    GROUP BY vc.id, vc.name, vc.house_no, vc.phone, vc.current_balance
    ORDER BY vc.current_balance DESC
  `;

  const result = await pool.query(query, params);

  // Calculate totals
  const totals = {
    total_customers: result.rows.length,
    total_outstanding: result.rows.reduce((sum, row) => sum + parseFloat(row.current_balance || 0), 0),
    total_credit_given: result.rows.reduce((sum, row) => sum + parseFloat(row.total_credit || 0), 0),
    total_payments_received: result.rows.reduce((sum, row) => sum + parseFloat(row.total_payments || 0), 0)
  };

  res.json({
    totals,
    customers: result.rows
  });
}));

module.exports = router;
