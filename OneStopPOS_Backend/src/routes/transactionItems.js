const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/transaction-items
 * Get all transaction items with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { transaction_id, product_id, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT ti.*, t.created_at as transaction_date, t.payment_method, t.status
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (transaction_id) {
    paramCount++;
    query += ` AND ti.transaction_id = $${paramCount}`;
    params.push(transaction_id);
  }

  if (product_id) {
    paramCount++;
    query += ` AND ti.product_id = $${paramCount}`;
    params.push(product_id);
  }

  paramCount++;
  query += ` ORDER BY t.created_at DESC LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  res.json({
    data: result.rows,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/transaction-items/stats/top-selling
 * Get top selling products
 * NOTE: Must come BEFORE /by-transaction/:transactionId to avoid route conflict
 */
router.get('/stats/top-selling', asyncHandler(async (req, res) => {
  const { start_date, end_date, limit = 10 } = req.query;

  let query = `
    SELECT
      ti.product_id,
      ti.product_name,
      SUM(ti.quantity) as total_quantity,
      SUM(ti.subtotal) as total_revenue,
      SUM(ti.cost * ti.quantity) as total_cost,
      SUM(ti.subtotal) - SUM(ti.cost * ti.quantity) as total_profit,
      COUNT(DISTINCT ti.transaction_id) as transaction_count
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.status != 'voided'
  `;
  const params = [];
  let paramCount = 0;

  if (start_date) {
    paramCount++;
    query += ` AND t.created_at >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND t.created_at <= $${paramCount}`;
    params.push(end_date);
  }

  paramCount++;
  query += ` GROUP BY ti.product_id, ti.product_name
             ORDER BY total_quantity DESC
             LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  const result = await pool.query(query, params);

  res.json(result.rows);
}));

/**
 * GET /api/transaction-items/stats/profit-by-product
 * Get profit breakdown by product
 */
router.get('/stats/profit-by-product', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  let query = `
    SELECT
      ti.product_id,
      ti.product_name,
      SUM(ti.quantity) as total_quantity,
      SUM(ti.subtotal) as total_revenue,
      SUM(ti.cost * ti.quantity) as total_cost,
      SUM(ti.subtotal) - SUM(ti.cost * ti.quantity) as total_profit,
      CASE
        WHEN SUM(ti.subtotal) > 0
        THEN ROUND(((SUM(ti.subtotal) - SUM(ti.cost * ti.quantity)) / SUM(ti.subtotal) * 100), 2)
        ELSE 0
      END as profit_margin_percent
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.status != 'voided'
  `;
  const params = [];
  let paramCount = 0;

  if (start_date) {
    paramCount++;
    query += ` AND t.created_at >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND t.created_at <= $${paramCount}`;
    params.push(end_date);
  }

  query += ` GROUP BY ti.product_id, ti.product_name
             ORDER BY total_profit DESC`;

  const result = await pool.query(query, params);

  // Get total summary
  let totalQuery = `
    SELECT
      COALESCE(SUM(ti.subtotal), 0) as total_revenue,
      COALESCE(SUM(ti.cost * ti.quantity), 0) as total_cost,
      COALESCE(SUM(ti.subtotal) - SUM(ti.cost * ti.quantity), 0) as total_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.status != 'voided'
  `;

  if (start_date || end_date) {
    const totalParams = [];
    let totalParamCount = 0;
    if (start_date) {
      totalParamCount++;
      totalQuery += ` AND t.created_at >= $${totalParamCount}`;
      totalParams.push(start_date);
    }
    if (end_date) {
      totalParamCount++;
      totalQuery += ` AND t.created_at <= $${totalParamCount}`;
      totalParams.push(end_date);
    }
    const totalResult = await pool.query(totalQuery, totalParams);
    res.json({
      products: result.rows,
      totals: totalResult.rows[0]
    });
  } else {
    const totalResult = await pool.query(totalQuery);
    res.json({
      products: result.rows,
      totals: totalResult.rows[0]
    });
  }
}));

/**
 * GET /api/transaction-items/by-transaction/:transactionId
 * Get all items for a specific transaction
 */
router.get('/by-transaction/:transactionId', asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  // Verify the transaction exists
  const transactionCheck = await pool.query(
    'SELECT id FROM transactions WHERE id = $1',
    [transactionId]
  );

  if (transactionCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const result = await pool.query(
    `SELECT * FROM transaction_items
     WHERE transaction_id = $1
     ORDER BY id ASC`,
    [transactionId]
  );

  res.json(result.rows);
}));

/**
 * GET /api/transaction-items/by-product/:productId
 * Get sales history for a specific product
 */
router.get('/by-product/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { start_date, end_date, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT ti.*, t.created_at as transaction_date, t.status
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE ti.product_id = $1 AND t.status != 'voided'
  `;
  const params = [productId];
  let paramCount = 1;

  if (start_date) {
    paramCount++;
    query += ` AND t.created_at >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND t.created_at <= $${paramCount}`;
    params.push(end_date);
  }

  paramCount++;
  query += ` ORDER BY t.created_at DESC LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  // Get summary stats for this product
  let statsQuery = `
    SELECT
      COUNT(*) as total_sales,
      COALESCE(SUM(ti.quantity), 0) as total_quantity_sold,
      COALESCE(SUM(ti.subtotal), 0) as total_revenue,
      COALESCE(SUM(ti.cost * ti.quantity), 0) as total_cost,
      COALESCE(SUM(ti.subtotal) - SUM(ti.cost * ti.quantity), 0) as total_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE ti.product_id = $1 AND t.status != 'voided'
  `;
  const statsParams = [productId];

  const statsResult = await pool.query(statsQuery, statsParams);

  res.json({
    data: result.rows,
    stats: statsResult.rows[0],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

module.exports = router;
