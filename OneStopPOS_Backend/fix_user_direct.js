const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const fixUserDirect = async () => {
  // Use environment variable for connection string
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Fixes the "self-signed certificate" error
    }
  });

  try {
    console.log('Connecting to Aiven Database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!');

    const username = 'userA';
    const password = 'userA123';
    
    console.log(`\nResetting password for user: ${username}`);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user directly
    const query = `
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (username) 
      DO UPDATE SET 
        password = EXCLUDED.password,
        is_active = true,
        email = EXCLUDED.email
      RETURNING id, username, email, role, is_active;
    `;

    const res = await client.query(query, [
      username, 
      'usera@example.com', 
      hashedPassword, 
      'User A', 
      'user'
    ]);

    console.log('\n✅ SUCCESS! User updated.');
    console.log('------------------------------------------------');
    console.log(`Username: ${res.rows[0].username}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${res.rows[0].role}`);
    console.log('------------------------------------------------');
    console.log('You can now log in.');

    client.release();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.message.includes('ssl')) {
        console.error('Hint: SSL issue detected. The script is trying to bypass it.');
    }
  } finally {
    await pool.end();
  }
};

fixUserDirect();
