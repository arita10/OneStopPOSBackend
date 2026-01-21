const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const fixUser = async () => {
  console.log('\n--- Fix User Login Script ---');
  console.log('This script will help you fix the "401 Unauthorized" error on Render.\n');

  rl.question('Paste your Render External Database URL (postgres://...): ', async (dbUrl) => {
    if (!dbUrl) {
      console.error('Error: Database URL is required.');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString: dbUrl.trim(),
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      console.log('\nConnecting to database...');
      const client = await pool.connect();
      console.log('Connected!');

      const username = 'userA';
      const password = 'userA123';
      
      console.log(`\nGenerating secure hash for password: ${password}`);
      const hashedPassword = await bcrypt.hash(password, 10);

      console.log(`Updating/Creating user '${username}'...`);
      
      // Upsert user (Update if exists, Insert if new)
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

      console.log('\n✅ User successfully fixed!');
      console.log('User Details:', res.rows[0]);
      console.log('\nTry logging in now with:');
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);

      client.release();
    } catch (err) {
      console.error('\n❌ Error:', err.message);
    } finally {
      await pool.end();
      rl.close();
      process.exit(0);
    }
  });
};

fixUser();
