const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

// System types that cannot be modified or deleted
const SYSTEM_TYPES = ['kasa', 'kart', 'devir'];

/**
 * GET /api/kasa/expense-types
 * Get all active expense types
 */
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM kasa_expense_types WHERE is_active = true ORDER BY name ASC'
  );
  res.json(result.rows);
}));

/**
 * GET /api/kasa/expense-types/:id
 * Get expense type by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM kasa_expense_types WHERE id = $1 AND is_active = true',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/kasa/expense-types
 * Create a new expense type
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Expense type name is required' });
  }

  // Check for duplicate name
  const existing = await pool.query(
    'SELECT id FROM kasa_expense_types WHERE name ILIKE $1 AND is_active = true',
    [name]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'An expense type with this name already exists' });
  }

  const result = await pool.query(
    `INSERT INTO kasa_expense_types (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name.toLowerCase(), description || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/kasa/expense-types/:id
 * Update an expense type
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  // Check if it's a system type
  const checkSystem = await pool.query('SELECT name FROM kasa_expense_types WHERE id = $1', [id]);
  if (checkSystem.rows.length > 0 && SYSTEM_TYPES.includes(checkSystem.rows[0].name)) {
    return res.status(403).json({ error: 'Cannot modify system expense types (kasa, kart, devir)' });
  }

  // Check for duplicate name if changing name
  if (name) {
    const existing = await pool.query(
      'SELECT id FROM kasa_expense_types WHERE name ILIKE $1 AND id != $2 AND is_active = true',
      [name, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An expense type with this name already exists' });
    }
  }

  const result = await pool.query(
    `UPDATE kasa_expense_types
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND is_active = true
     RETURNING *`,
    [name ? name.toLowerCase() : null, description, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/kasa/expense-types/:id
 * Soft delete an expense type
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if it's a system type
  const checkSystem = await pool.query('SELECT name FROM kasa_expense_types WHERE id = $1', [id]);
  if (checkSystem.rows.length > 0 && SYSTEM_TYPES.includes(checkSystem.rows[0].name)) {
    return res.status(403).json({ error: 'Cannot delete system expense types (kasa, kart, devir)' });
  }

  const result = await pool.query(
    'UPDATE kasa_expense_types SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  res.json({ message: 'Expense type deleted successfully' });
}));

module.exports = router;