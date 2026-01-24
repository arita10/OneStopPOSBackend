const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/transactions
 * Get all transactions with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT * FROM transactions
     WHERE user_id = $3
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), parseInt(offset), userId]
  );

  const countResult = await pool.query('SELECT COUNT(*) FROM transactions WHERE user_id = $1', [userId]);

  res.json({
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/transactions/:id
 * Get transaction by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/transactions
 * Create a new transaction
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    items,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    amount_paid,
    change_amount,
    notes,
    cashier_id
  } = req.body;
  const userId = req.user.id;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  if (!total) {
    return res.status(400).json({ error: 'Total amount is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the transaction
    const result = await client.query(
      `INSERT INTO transactions
       (items, subtotal, discount, tax, total, payment_method, amount_paid, change_amount, notes, cashier_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        JSON.stringify(items),
        subtotal || 0,
        discount || 0,
        tax || 0,
        total,
        payment_method || 'cash',
        amount_paid || total,
        change_amount || 0,
        notes || null,
        cashier_id || null,
        userId
      ]
    );

    // Update product stock for each item and create transaction items
    for (const item of items) {
      let itemCost = 0;

      if (item.product_id) {
        const updateResult = await client.query(
          'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING cost',
          [item.quantity || 1, item.product_id, userId]
        );
        
        if (updateResult.rows.length > 0) {
          itemCost = updateResult.rows[0].cost;
        }
      }

      // Insert into transaction_items table
      await client.query(
        `INSERT INTO transaction_items 
         (transaction_id, product_id, product_name, quantity, unit_price, cost, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          result.rows[0].id,
          item.product_id || null,
          item.name || 'Unknown Item',
          item.quantity || 1,
          item.price || 0,
          itemCost || 0,
          item.subtotal || ((item.price || 0) * (item.quantity || 1))
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * DELETE /api/transactions/:id
 * Void/delete a transaction
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the transaction first
    const transactionResult = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (transactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = transactionResult.rows[0];

    // Restore product stock
    if (transaction.items && Array.isArray(transaction.items)) {
      for (const item of transaction.items) {
        if (item.product_id) {
          await client.query(
            'UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
            [item.quantity || 1, item.product_id, userId]
          );
        }
      }
    }

    // Mark as voided instead of deleting
    await client.query(
      "UPDATE transactions SET status = 'voided' WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Transaction voided successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * GET /api/transactions/stats/summary
 * Get transaction statistics summary
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id;

  let dateFilter = ' AND user_id = $1';
  const params = [userId];

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND created_at >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND created_at <= $${params.length}`;
  }

  const result = await pool.query(
    `SELECT
       COUNT(*) as total_transactions,
       COALESCE(SUM(total), 0) as total_sales,
       COALESCE(AVG(total), 0) as average_sale,
       COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END), 0) as credit_sales,
       COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_transactions
     FROM transactions
     WHERE status != 'voided' ${dateFilter}`,
    params
  );

  res.json(result.rows[0]);
}));

module.exports = router;
