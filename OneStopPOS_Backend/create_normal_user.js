const pool = require('./src/config/database');
const bcrypt = require('bcryptjs');

const createNormalUser = async () => {
  try {
    const username = 'normaluser';
    const email = 'user@onestoppos.com';
    const password = 'user123';
    const fullName = 'Normal User';
    const role = 'user';

    console.log(`Creating user: ${username} (${email})`);

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           password = EXCLUDED.password,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role
       RETURNING id, username, email, role, created_at`,
      [username, email, hashedPassword, fullName, role]
    );

    console.log('User created/updated successfully:');
    console.log(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
  } finally {
    await pool.end();
  }
};

createNormalUser();
