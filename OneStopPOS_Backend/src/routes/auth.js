const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireAdmin, generateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Find user by username
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND is_active = true',
    [username]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = result.rows[0];

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Update last login
  await pool.query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Generate token
  const token = generateToken(user.id, user.role);

  // Return user info (excluding password)
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      last_login: new Date()
    }
  });
}));

/**
 * POST /api/auth/register
 * Register new user (admin only)
 */
router.post('/register', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { username, email, password, full_name, role } = req.body;

  // Validate input
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (role && !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
  }

  // Check if username or email already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(400).json({ error: 'Username or email already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const result = await pool.query(
    `INSERT INTO users (username, email, password, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, full_name, role, is_active, created_at`,
    [username, email, hashedPassword, full_name, role || 'user']
  );

  res.status(201).json({
    message: 'User created successfully',
    user: result.rows[0]
  });
}));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
  );

  res.json(result.rows);
}));

/**
 * GET /api/auth/users/:id
 * Get user by ID (admin only)
 */
router.get('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * PUT /api/auth/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, email, full_name, role, is_active } = req.body;

  const result = await pool.query(
    `UPDATE users
     SET username = COALESCE($1, username),
         email = COALESCE($2, email),
         full_name = COALESCE($3, full_name),
         role = COALESCE($4, role),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING id, username, email, full_name, role, is_active, updated_at`,
    [username, email, full_name, role, is_active, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * PUT /api/auth/change-password
 * Change own password
 */
router.put('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // Get current user with password
  const result = await pool.query(
    'SELECT password FROM users WHERE id = $1',
    [req.user.id]
  );

  const user = result.rows[0];

  // Verify current password
  const isPasswordValid = await bcrypt.compare(current_password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(new_password, 10);

  // Update password
  await pool.query(
    'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hashedPassword, req.user.id]
  );

  res.json({ message: 'Password changed successfully' });
}));

/**
 * DELETE /api/auth/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent deleting own account
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const result = await pool.query(
    'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ message: 'User deleted successfully' });
}));

module.exports = router;
