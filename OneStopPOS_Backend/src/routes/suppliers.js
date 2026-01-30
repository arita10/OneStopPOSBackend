const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/suppliers
 * Get all suppliers for the authenticated user
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { search } = req.query;

  let query = 'SELECT * FROM suppliers WHERE user_id = $1 AND is_active = true';
  const params = [userId];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }

  query += ' ORDER BY name ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/suppliers/:id
 * Get supplier by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM suppliers WHERE id = $1 AND user_id = $2 AND is_active = true',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/suppliers
 * Create a new supplier
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, phone, email, tax_id, address, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  // Check for duplicate name for this user
  const existing = await pool.query(
    'SELECT id FROM suppliers WHERE name ILIKE $1 AND user_id = $2 AND is_active = true',
    [name, userId]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'A supplier with this name already exists' });
  }

  const result = await pool.query(
    `INSERT INTO suppliers (user_id, name, phone, email, tax_id, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, name, phone || null, email || null, tax_id || null, address || null, notes || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/suppliers/:id
 * Update a supplier
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, phone, email, tax_id, address, notes } = req.body;

  // Check for duplicate name (excluding current supplier)
  if (name) {
    const existing = await pool.query(
      'SELECT id FROM suppliers WHERE name ILIKE $1 AND user_id = $2 AND id != $3 AND is_active = true',
      [name, userId, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A supplier with this name already exists' });
    }
  }

  const result = await pool.query(
    `UPDATE suppliers
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         email = COALESCE($3, email),
         tax_id = COALESCE($4, tax_id),
         address = COALESCE($5, address),
         notes = COALESCE($6, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND user_id = $8 AND is_active = true
     RETURNING *`,
    [name, phone, email, tax_id, address, notes, id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/suppliers/:id
 * Soft delete a supplier
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE suppliers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  res.json({ message: 'Supplier deleted successfully' });
}));

module.exports = router;
