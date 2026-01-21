const pool = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function recreateUserA() {
  const client = await pool.connect();
  
  try {
    console.log('Starting user recreation process...');
    await client.query('BEGIN');

    const username = 'userA';
    const email = 'usera@onestoppos.com';
    const passwordRaw = 'userA123';
    const fullName = 'User A';
    const role = 'user';

    // 1. Delete existing userA
    console.log(`Deleting user '${username}' if exists...`);
    const deleteRes = await client.query('DELETE FROM users WHERE username = $1 RETURNING id', [username]);
    if (deleteRes.rows.length > 0) {
      console.log(`Deleted user with ID: ${deleteRes.rows[0].id}`);
    } else {
      console.log('User did not exist.');
    }

    // 2. Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(passwordRaw, 10);

    // 3. Insert new userA
    console.log(`Creating new user '${username}'...`);
    const insertQuery = `
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, username, email, role, created_at;
    `;
    
    const insertRes = await client.query(insertQuery, [username, email, hashedPassword, fullName, role]);
    const newUser = insertRes.rows[0];

    console.log('User created successfully:');
    console.log(newUser);

    await client.query('COMMIT');
    console.log('✅ Transaction committed.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recreating user:', error);
    if (error.code === '23505') { // unique_violation
        console.error('Hint: Check if the email address is already used by another user.');
    }
  } finally {
    client.release();
    pool.end();
  }
}

recreateUserA();
