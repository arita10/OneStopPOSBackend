const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/products
 * Get all products with optional search
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search } = req.query;
  const userId = req.user.id;

  let query = 'SELECT * FROM products WHERE is_active = true AND user_id = $1';
  const params = [userId];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR barcode ILIKE $${params.length} OR category ILIKE $${params.length})`;
  }

  query += ' ORDER BY name ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1 AND user_id = $2 AND is_active = true',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * GET /api/products/barcode/:barcode
 * Get product by barcode
 */
router.get('/barcode/:barcode', asyncHandler(async (req, res) => {
  const { barcode } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT * FROM products WHERE barcode = $1 AND user_id = $2 AND is_active = true',
    [barcode, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/products
 * Create a new product
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, barcode, price, cost, stock, category, description, image_url, unit } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  const result = await pool.query(
    `INSERT INTO products (name, barcode, price, cost, stock, category, description, image_url, unit, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [name, barcode || null, price || 0, cost || 0, stock || 0, category || null, description || null, image_url || null, unit || 'pcs', userId]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/products/:id
 * Update a product
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, barcode, price, cost, stock, category, description, image_url, unit } = req.body;
  const userId = req.user.id;

  const result = await pool.query(
    `UPDATE products
     SET name = COALESCE($1, name),
         barcode = COALESCE($2, barcode),
         price = COALESCE($3, price),
         cost = COALESCE($4, cost),
         stock = COALESCE($5, stock),
         category = COALESCE($6, category),
         description = COALESCE($7, description),
         image_url = COALESCE($8, image_url),
         unit = COALESCE($9, unit),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10 AND user_id = $11 AND is_active = true
     RETURNING *`,
    [name, barcode, price, cost, stock, category, description, image_url, unit, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/products/:id
 * Soft delete a product
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({ message: 'Product deleted successfully' });
}));

/**
 * PATCH /api/products/:id/stock
 * Update product stock
 */
router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  const userId = req.user.id;

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({ error: 'Quantity is required' });
  }

  const result = await pool.query(
    `UPDATE products
     SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3 AND is_active = true
     RETURNING *`,
    [quantity, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(result.rows[0]);
}));

module.exports = router;
