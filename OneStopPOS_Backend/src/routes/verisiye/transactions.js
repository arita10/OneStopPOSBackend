const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/verisiye/transactions
 * Get all credit transactions with filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    customer_id,
    house_no,
    name,
    start_date,
    end_date,
    limit = 100,
    offset = 0
  } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT vt.*, vc.name as customer_name, vc.house_no as customer_house_no, vc.phone as customer_phone
    FROM verisiye_transactions vt
    JOIN verisiye_customers vc ON vt.customer_id = vc.id
    WHERE vt.user_id = $1
  `;
  const params = [userId];
  let paramCount = 1;

  if (customer_id) {
    paramCount++;
    query += ` AND vt.customer_id = $${paramCount}`;
    params.push(customer_id);
  }

  if (house_no) {
    paramCount++;
    query += ` AND vc.house_no ILIKE $${paramCount}`;
    params.push(`%${house_no}%`);
  }

  if (name) {
    paramCount++;
    query += ` AND vc.name ILIKE $${paramCount}`;
    params.push(`%${name}%`);
  }

  if (start_date) {
    paramCount++;
    query += ` AND vt.created_at >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND vt.created_at <= $${paramCount}`;
    params.push(end_date);
  }

  query += ' ORDER BY vt.created_at DESC';

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = `
    SELECT COUNT(*) FROM verisiye_transactions vt
    JOIN verisiye_customers vc ON vt.customer_id = vc.id
    WHERE vt.user_id = $1
  `;
  const countParams = [userId];
  let countParamNum = 1;

  if (customer_id) {
    countParamNum++;
    countQuery += ` AND vt.customer_id = $${countParamNum}`;
    countParams.push(customer_id);
  }

  if (house_no) {
    countParamNum++;
    countQuery += ` AND vc.house_no ILIKE $${countParamNum}`;
    countParams.push(`%${house_no}%`);
  }

  if (name) {
    countParamNum++;
    countQuery += ` AND vc.name ILIKE $${countParamNum}`;
    countParams.push(`%${name}%`);
  }

  if (start_date) {
    countParamNum++;
    countQuery += ` AND vt.created_at >= $${countParamNum}`;
    countParams.push(start_date);
  }

  if (end_date) {
    countParamNum++;
    countQuery += ` AND vt.created_at <= $${countParamNum}`;
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
 * GET /api/verisiye/transactions/:id
 * Get credit transaction by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT vt.*, vc.name as customer_name, vc.house_no as customer_house_no, vc.phone as customer_phone
     FROM verisiye_transactions vt
     JOIN verisiye_customers vc ON vt.customer_id = vc.id
     WHERE vt.id = $1 AND vt.user_id = $2`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/verisiye/transactions
 * Create a new credit transaction
 */
router.post('/', asyncHandler(async (req, res) => {
  const { customer_id, type, amount, description, reference_id } = req.body;
  const userId = req.user.id;

  if (!customer_id) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }

  if (!type || !['credit', 'payment'].includes(type)) {
    return res.status(400).json({ error: 'Type must be either "credit" or "payment"' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current customer balance
    const customerResult = await client.query(
      'SELECT * FROM verisiye_customers WHERE id = $1 AND user_id = $2 AND is_active = true',
      [customer_id, userId]
    );

    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];
    let newBalance;

    // Calculate new balance
    if (type === 'credit') {
      // Customer is taking on credit (owes more)
      newBalance = parseFloat(customer.current_balance) + parseFloat(amount);
    } else {
      // Customer is making a payment (owes less)
      newBalance = parseFloat(customer.current_balance) - parseFloat(amount);
    }

    // Create the transaction
    const transactionResult = await client.query(
      `INSERT INTO verisiye_transactions (customer_id, type, amount, description, reference_id, balance_after, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [customer_id, type, amount, description || null, reference_id || null, newBalance, userId]
    );

    // Update customer balance
    await client.query(
      'UPDATE verisiye_customers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [newBalance, customer_id, userId]
    );

    await client.query('COMMIT');

    // Return transaction with customer info
    const fullResult = await pool.query(
      `SELECT vt.*, vc.name as customer_name, vc.house_no as customer_house_no
       FROM verisiye_transactions vt
       JOIN verisiye_customers vc ON vt.customer_id = vc.id
       WHERE vt.id = $1 AND vt.user_id = $2`,
      [transactionResult.rows[0].id, userId]
    );

    res.status(201).json(fullResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * DELETE /api/verisiye/transactions/:id
 * Delete a credit transaction (and reverse the balance change)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the transaction
    const transactionResult = await client.query(
      'SELECT * FROM verisiye_transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (transactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = transactionResult.rows[0];

    // Reverse the balance change
    const balanceChange = transaction.type === 'credit'
      ? -parseFloat(transaction.amount)
      : parseFloat(transaction.amount);

    await client.query(
      'UPDATE verisiye_customers SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [balanceChange, transaction.customer_id, userId]
    );

    // Delete the transaction
    await client.query('DELETE FROM verisiye_transactions WHERE id = $1 AND user_id = $2', [id, userId]);

    await client.query('COMMIT');
    res.json({ message: 'Transaction deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

module.exports = router;
