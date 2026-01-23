const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/kasa/balance-sheets
 * Get all balance sheets with optional date range filter
 */
router.get('/', asyncHandler(async (req, res) => {
  const { start_date, end_date, limit = 100, offset = 0 } = req.query;
  const userId = req.user.id;

  let query = 'SELECT * FROM kasa_balance_sheets WHERE user_id = $1';
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

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM kasa_balance_sheets WHERE user_id = $1';
  const countParams = [userId];
  let countParamNum = 1;

  if (start_date) {
    countParamNum++;
    countQuery += ` AND date >= $${countParamNum}`;
    countParams.push(start_date);
  }

  if (end_date) {
    countParamNum++;
    countQuery += ` AND date <= $${countParamNum}`;
    countParams.push(end_date);
  }

  const countResult = await pool.query(countQuery, countParams);

  res.json({
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/kasa/balance-sheets/:date
 * Get balance sheet by date
 */
router.get('/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT * FROM kasa_balance_sheets WHERE date = $1 AND user_id = $2',
    [date, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Balance sheet not found for this date' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/kasa/balance-sheets
 * Create or update a balance sheet for a date
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    date,
    items,
    opening_balance,
    total_sales,
    total_expenses,
    total_card_sales,
    total_cash_sales,
    closing_balance,
    notes
  } = req.body;
  const userId = req.user.id;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Check if balance sheet exists for this date
  const existingResult = await pool.query(
    'SELECT id FROM kasa_balance_sheets WHERE date = $1 AND user_id = $2',
    [date, userId]
  );

  let result;

  if (existingResult.rows.length > 0) {
    // Update existing balance sheet
    result = await pool.query(
      `UPDATE kasa_balance_sheets
       SET items = COALESCE($1, items),
           opening_balance = COALESCE($2, opening_balance),
           total_sales = COALESCE($3, total_sales),
           total_expenses = COALESCE($4, total_expenses),
           total_card_sales = COALESCE($5, total_card_sales),
           total_cash_sales = COALESCE($6, total_cash_sales),
           closing_balance = COALESCE($7, closing_balance),
           notes = COALESCE($8, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE date = $9 AND user_id = $10
       RETURNING *`,
      [
        items ? JSON.stringify(items) : null,
        opening_balance,
        total_sales,
        total_expenses,
        total_card_sales,
        total_cash_sales,
        closing_balance,
        notes,
        date,
        userId
      ]
    );
  } else {
    // Create new balance sheet
    result = await pool.query(
      `INSERT INTO kasa_balance_sheets
       (date, items, opening_balance, total_sales, total_expenses, total_card_sales, total_cash_sales, closing_balance, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        date,
        JSON.stringify(items || []),
        opening_balance || 0,
        total_sales || 0,
        total_expenses || 0,
        total_card_sales || 0,
        total_cash_sales || 0,
        closing_balance || 0,
        notes || null,
        userId
      ]
    );
  }

  res.status(existingResult.rows.length > 0 ? 200 : 201).json(result.rows[0]);
}));

/**
 * DELETE /api/kasa/balance-sheets/:date
 * Delete a balance sheet by date
 */
router.delete('/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'DELETE FROM kasa_balance_sheets WHERE date = $1 AND user_id = $2 RETURNING *',
    [date, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Balance sheet not found for this date' });
  }

  res.json({ message: 'Balance sheet deleted successfully' });
}));

module.exports = router;
