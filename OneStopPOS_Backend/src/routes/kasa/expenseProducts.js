const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/kasa/expense-products
 * Get all expense products with optional category filter
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM kasa_expense_products WHERE is_active = true';
  const params = [];

  if (category && ['kasa', 'kart', 'devir'].includes(category)) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  query += ' ORDER BY category, name ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * POST /api/kasa/expense-products
 * Create a new expense product
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, category, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Expense product name is required' });
  }

  if (!category || !['kasa', 'kart', 'devir'].includes(category)) {
    return res.status(400).json({ error: 'Category must be one of: kasa, kart, devir' });
  }

  const result = await pool.query(
    `INSERT INTO kasa_expense_products (name, category, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, category, description || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/kasa/expense-products/:id
 * Update an expense product
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, category, description } = req.body;

  if (category && !['kasa', 'kart', 'devir'].includes(category)) {
    return res.status(400).json({ error: 'Category must be one of: kasa, kart, devir' });
  }

  const result = await pool.query(
    `UPDATE kasa_expense_products
     SET name = COALESCE($1, name),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND is_active = true
     RETURNING *`,
    [name, category, description, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense product not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/kasa/expense-products/:id
 * Soft delete an expense product
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE kasa_expense_products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense product not found' });
  }

  res.json({ message: 'Expense product deleted successfully' });
}));

module.exports = router;
