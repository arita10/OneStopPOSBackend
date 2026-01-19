const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/verisiye/customers
 * Get all credit customers with optional search
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search } = req.query;

  let query = 'SELECT * FROM verisiye_customers WHERE is_active = true';
  const params = [];

  if (search) {
    query += ' AND (name ILIKE $1 OR house_no ILIKE $1 OR phone ILIKE $1)';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/verisiye/customers/:id
 * Get customer by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM verisiye_customers WHERE id = $1 AND is_active = true',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/verisiye/customers
 * Create a new credit customer
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, house_no, phone, address, email, credit_limit, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const result = await pool.query(
    `INSERT INTO verisiye_customers (name, house_no, phone, address, email, credit_limit, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, house_no || null, phone || null, address || null, email || null, credit_limit || 0, notes || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/verisiye/customers/:id
 * Update a customer
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, house_no, phone, address, email, credit_limit, notes } = req.body;

  const result = await pool.query(
    `UPDATE verisiye_customers
     SET name = COALESCE($1, name),
         house_no = COALESCE($2, house_no),
         phone = COALESCE($3, phone),
         address = COALESCE($4, address),
         email = COALESCE($5, email),
         credit_limit = COALESCE($6, credit_limit),
         notes = COALESCE($7, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8 AND is_active = true
     RETURNING *`,
    [name, house_no, phone, address, email, credit_limit, notes, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/verisiye/customers/:id
 * Soft delete a customer
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE verisiye_customers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json({ message: 'Customer deleted successfully' });
}));

module.exports = router;
