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
  const { limit = 100, offset = 0, search } = req.query;

  let query = `
    SELECT * FROM suppliers 
    WHERE user_id = $1 AND is_active = true
  `;
  const params = [userId];
  let paramCount = 1;

  if (search) {
    paramCount++;
    query += ` AND (name ILIKE $${paramCount} OR contact_person ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name ASC';

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = `
    SELECT COUNT(*) FROM suppliers 
    WHERE user_id = $1 AND is_active = true
  `;
  const countParams = [userId];
  let countParamNum = 1;

  if (search) {
    countParamNum++;
    countQuery += ` AND (name ILIKE $${countParamNum} OR contact_person ILIKE $${countParamNum} OR phone ILIKE $${countParamNum})`;
    countParams.push(`%${search}%`);
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
  const {
    name,
    contact_person,
    phone,
    email,
    tax_id,
    address,
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO suppliers 
       (user_id, name, contact_person, phone, email, tax_id, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        name,
        contact_person || null,
        phone || null,
        email || null,
        tax_id || null,
        address || null,
        notes || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'A supplier with this name already exists' });
    }
    throw error;
  }
}));

/**
 * PUT /api/suppliers/:id
 * Update a supplier
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    name,
    contact_person,
    phone,
    email,
    tax_id,
    address,
    notes
  } = req.body;

  // Check if supplier exists
  const checkResult = await pool.query(
    'SELECT id FROM suppliers WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  try {
    const result = await pool.query(
      `UPDATE suppliers
       SET name = COALESCE($1, name),
           contact_person = COALESCE($2, contact_person),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           tax_id = COALESCE($5, tax_id),
           address = COALESCE($6, address),
           notes = COALESCE($7, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        name,
        contact_person,
        phone,
        email,
        tax_id,
        address,
        notes,
        id,
        userId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'A supplier with this name already exists' });
    }
    throw error;
  }
}));

/**
 * DELETE /api/suppliers/:id
 * Soft delete a supplier
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE suppliers 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND user_id = $2 
     RETURNING id`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  res.json({ message: 'Supplier deleted successfully' });
}));

module.exports = router;
