const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/kasa/expense-types
 * Get all expense types for the authenticated user
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT * FROM expense_types WHERE user_id = $1 AND is_active = true ORDER BY name ASC',
    [userId]
  );

  res.json(result.rows);
}));

/**
 * GET /api/kasa/expense-types/:id
 * Get expense type by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM expense_types WHERE id = $1 AND user_id = $2 AND is_active = true',
    [id, userId]
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
  const userId = req.user.id;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Expense type name is required' });
  }

  // Check for duplicate name
  const existing = await pool.query(
    'SELECT id FROM expense_types WHERE name ILIKE $1 AND user_id = $2 AND is_active = true',
    [name, userId]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'An expense type with this name already exists' });
  }

  const result = await pool.query(
    `INSERT INTO expense_types (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, description || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/kasa/expense-types/init-defaults
 * Initialize default expense types for user (kasa, kart, devir)
 */
router.post('/init-defaults', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const defaults = [
    { name: 'kasa', description: 'Cash expenses' },
    { name: 'kart', description: 'Card expenses' },
    { name: 'devir', description: 'Carry over expenses' }
  ];

  const inserted = [];

  for (const def of defaults) {
    // Check if exists
    const existing = await pool.query(
      'SELECT id FROM expense_types WHERE name ILIKE $1 AND user_id = $2',
      [def.name, userId]
    );

    if (existing.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO expense_types (user_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, def.name, def.description]
      );
      inserted.push(result.rows[0]);
    }
  }

  res.status(201).json({
    message: `${inserted.length} default expense types created`,
    created: inserted
  });
}));

/**
 * PUT /api/kasa/expense-types/:id
 * Update an expense type
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, description } = req.body;

  // Check for duplicate name (excluding current)
  if (name) {
    const existing = await pool.query(
      'SELECT id FROM expense_types WHERE name ILIKE $1 AND user_id = $2 AND id != $3 AND is_active = true',
      [name, userId, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An expense type with this name already exists' });
    }
  }

  const result = await pool.query(
    `UPDATE expense_types
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND user_id = $4 AND is_active = true
     RETURNING *`,
    [name, description, id, userId]
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
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE expense_types SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  res.json({ message: 'Expense type deleted successfully' });
}));

module.exports = router;
