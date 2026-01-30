const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/categories
 * Get all categories
 */
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM categories WHERE is_active = true ORDER BY name ASC'
  );
  res.json(result.rows);
}));

/**
 * GET /api/categories/:id
 * Get category by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM categories WHERE id = $1 AND is_active = true',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  // Check for duplicate name
  const existing = await pool.query(
    'SELECT id FROM categories WHERE name ILIKE $1 AND is_active = true',
    [name]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Category with this name already exists' });
  }

  const result = await pool.query(
    `INSERT INTO categories (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/categories/:id
 * Update a category
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  // Check for duplicate name (excluding current category)
  if (name) {
    const existing = await pool.query(
      'SELECT id FROM categories WHERE name ILIKE $1 AND id != $2 AND is_active = true',
      [name, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
  }

  const result = await pool.query(
    `UPDATE categories
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND is_active = true
     RETURNING *`,
    [name, description, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/categories/:id
 * Soft delete a category
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE categories SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json({ message: 'Category deleted successfully' });
}));

module.exports = router;
