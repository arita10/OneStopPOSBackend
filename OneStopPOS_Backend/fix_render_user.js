const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ------------------------------------------------------------------
// PASTE YOUR RENDER DATABASE URL HERE
// Example: postgres://user:pass@host:port/dbname?ssl=true
const DATABASE_URL = 'PASTE_YOUR_RENDER_DATABASE_URL_HERE';
// ------------------------------------------------------------------

async function fixUser() {
  if (DATABASE_URL.includes('PASTE_YOUR')) {
    console.error('❌ Please edit this file and paste your Render Database URL in the DATABASE_URL variable.');
    return;
  }

  // Allow self-signed certs for Render/Cloud
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Render Database...');
    const client = await pool.connect();
    console.log('✅ Connected.');

    const username = 'userA';
    const password = 'userA123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Delete if exists
    console.log(`🗑️  Removing old '${username}'...`);
    await client.query('DELETE FROM users WHERE username = $1', [username]);

    // 2. Insert new
    console.log(`Pm  Creating new '${username}'...`);
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [username, 'usera@onestoppos.com', hashedPassword, 'User A', 'user']);

    console.log(`
✅ Success!
-------------------------
User:     ${username}
Password: ${password}
-------------------------
Try logging in now.
    `);

    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixUser();
