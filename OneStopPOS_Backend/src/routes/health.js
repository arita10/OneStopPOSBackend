const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', asyncHandler(async (req, res) => {
  let dbStatus = 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error: ' + error.message;
  }

  res.json({
    status: 'healthy',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;
