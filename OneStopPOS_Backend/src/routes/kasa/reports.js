const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/kasa/reports/daily-profit
 * Get daily profit report for a date range
 */
router.get('/daily-profit', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT
      date,
      total_sales,
      total_expenses,
      total_card_sales,
      total_cash_sales,
      (total_sales - total_expenses) as gross_profit,
      closing_balance
    FROM kasa_balance_sheets
    WHERE user_id = $1
  `;
  const params = [userId];
  let paramCount = 1;

  if (start_date) {
    paramCount++;
    query += ` AND date >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND date <= $${paramCount}`;
    params.push(end_date);
  }

  query += ' ORDER BY date DESC';

  const result = await pool.query(query, params);

  // Calculate summary totals
  const summary = {
    total_sales: 0,
    total_expenses: 0,
    total_card_sales: 0,
    total_cash_sales: 0,
    total_gross_profit: 0,
    days_count: result.rows.length
  };

  result.rows.forEach(row => {
    summary.total_sales += parseFloat(row.total_sales || 0);
    summary.total_expenses += parseFloat(row.total_expenses || 0);
    summary.total_card_sales += parseFloat(row.total_card_sales || 0);
    summary.total_cash_sales += parseFloat(row.total_cash_sales || 0);
    summary.total_gross_profit += parseFloat(row.gross_profit || 0);
  });

  res.json({
    summary,
    daily_data: result.rows
  });
}));

/**
 * GET /api/kasa/reports/summary
 * Get summary for a specific date (combines transaction data with balance sheet)
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const { date } = req.query;
  const userId = req.user.id;

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Get balance sheet for the date
  const balanceSheetResult = await pool.query(
    'SELECT * FROM kasa_balance_sheets WHERE date = $1 AND user_id = $2',
    [targetDate, userId]
  );

  // Get transactions for the date
  const transactionsResult = await pool.query(
    `SELECT
       COUNT(*) as transaction_count,
       COALESCE(SUM(total), 0) as total_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END), 0) as credit_sales,
       COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count
     FROM transactions
     WHERE DATE(created_at) = $1 AND user_id = $2 AND status != 'voided'`,
    [targetDate, userId]
  );

  // Get verisiye (credit) summary for the date
  const verisiyeResult = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credit_given,
       COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as payments_received
     FROM verisiye_transactions
     WHERE DATE(created_at) = $1 AND user_id = $2`,
    [targetDate, userId]
  );

  const balanceSheet = balanceSheetResult.rows[0] || null;
  const transactions = transactionsResult.rows[0];
  const verisiye = verisiyeResult.rows[0];

  res.json({
    date: targetDate,
    balance_sheet: balanceSheet,
    transactions: {
      count: parseInt(transactions.transaction_count),
      total_sales: parseFloat(transactions.total_sales),
      cash_sales: parseFloat(transactions.cash_sales),
      card_sales: parseFloat(transactions.card_sales),
      credit_sales: parseFloat(transactions.credit_sales),
      voided_count: parseInt(transactions.voided_count)
    },
    verisiye: {
      credit_given: parseFloat(verisiye.credit_given),
      payments_received: parseFloat(verisiye.payments_received),
      net: parseFloat(verisiye.credit_given) - parseFloat(verisiye.payments_received)
    }
  });
}));

module.exports = router;
