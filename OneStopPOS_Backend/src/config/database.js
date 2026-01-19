const { Pool } = require('pg');
require('dotenv').config();

// For Aiven cloud databases, we need to handle SSL properly
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    // Aiven uses self-signed certificates
  }
});

// Suppress the SSL warning for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
