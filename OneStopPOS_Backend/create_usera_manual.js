const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Explicitly allow self-signed certs for this script execution
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const createUserA = async () => {
  console.log('Starting user creation script for "userA"...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  // Create a dedicated pool for this script with explicit SSL settings
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    }
  });

  try {
    const username = 'userA';
    // Using a placeholder email since it wasn't specified, but it's usually required
    const email = 'usera@example.com'; 
    const password = 'userA123';
    const fullName = 'Normal User A';
    const role = 'user';

    console.log(`Connecting to database...`);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (username) DO UPDATE
      SET email = EXCLUDED.email,
          password = EXCLUDED.password,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = true
      RETURNING id, username, role, created_at;
    `;

    const result = await pool.query(query, [username, email, hashedPassword, fullName, role]);

    console.log('✅ User "userA" created/updated successfully!');
    console.log('User Details:', result.rows[0]);

  } catch (err) {
    console.error('❌ Error creating user:', err);
    console.error('Error details:', err.message);
  } finally {
    await pool.end();
  }
};

createUserA();
