const pool = require('./src/config/database');

const migrate = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting migration to multi-tenancy...');

    // 1. Get default admin user ID
    const userRes = await client.query("SELECT id FROM users WHERE username = 'admin'");
    let adminId;
    
    if (userRes.rows.length > 0) {
      adminId = userRes.rows[0].id;
      console.log(`Found admin user ID: ${adminId}`);
    } else {
      // If no admin, checking if there are any users at all
      const anyUser = await client.query("SELECT id FROM users LIMIT 1");
      if (anyUser.rows.length > 0) {
        adminId = anyUser.rows[0].id;
        console.log(`No 'admin' found, using first available user ID: ${adminId}`);
      } else {
        console.log("No users found. Creating 'admin' user for migration purposes.");
        // We rely on initDb having run or we create one? 
        // Assuming initDb logic handles user creation usually, but here we might have existing data without users?
        // Unlikely given the schema, but let's be safe.
        // If no users exist, we can't assign data to anyone. 
        // But if no users exist, maybe no data exists?
        // Let's create a placeholder admin if needed.
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('admin123', 10);
        const newUser = await client.query(
            "INSERT INTO users (username, email, password, full_name, role) VALUES ('admin', 'admin@onestoppos.com', $1, 'System Admin', 'admin') RETURNING id",
            [hash]
        );
        adminId = newUser.rows[0].id;
        console.log(`Created admin user ID: ${adminId}`);
      }
    }

    const tables = [
      'products',
      'transactions', 
      'verisiye_customers',
      'verisiye_transactions',
      'kasa_expense_products',
      'kasa_balance_sheets'
    ];

    for (const table of tables) {
        console.log(`Processing table: ${table}...`);
        
        // Check if user_id column exists
        const colCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'user_id'
        `, [table]);

        if (colCheck.rows.length === 0) {
            console.log(`  Adding user_id column to ${table}...`);
            await client.query(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
            
            console.log(`  Assigning existing records to user ID ${adminId}...`);
            await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [adminId]);
            
            console.log(`  Setting user_id to NOT NULL...`);
            await client.query(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`);
            
            console.log(`  Adding Foreign Key constraint...`);
            await client.query(`ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
            
            console.log(`  Creating index on user_id...`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id)`);

            // Handle Specific Unique Constraints
            if (table === 'products') {
                console.log('  Updating products unique constraint (barcode)...');
                // Check if old constraint exists. Name is usually products_barcode_key
                try {
                    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key`);
                    await client.query(`ALTER TABLE products ADD CONSTRAINT products_barcode_user_unique UNIQUE (barcode, user_id)`);
                } catch (e) {
                    console.log('  Warning: Could not update unique constraint for products (might not exist or different name).', e.message);
                }
            }

            if (table === 'kasa_balance_sheets') {
                console.log('  Updating kasa_balance_sheets unique constraint (date)...');
                try {
                    await client.query(`ALTER TABLE kasa_balance_sheets DROP CONSTRAINT IF EXISTS kasa_balance_sheets_date_key`);
                    await client.query(`ALTER TABLE kasa_balance_sheets ADD CONSTRAINT kasa_balance_sheets_date_user_unique UNIQUE (date, user_id)`);
                } catch (e) {
                    console.log('  Warning: Could not update unique constraint for kasa_balance_sheets.', e.message);
                }
            }

        } else {
            console.log(`  user_id already exists on ${table}. Skipping column addition.`);
        }
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
