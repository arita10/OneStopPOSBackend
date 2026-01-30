require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('Database URL status:', process.env.DATABASE_URL ? 'Defined' : 'Undefined');

// Create a direct pool connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createSuppliersTable = async () => {
  // ... rest of the script
  try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        console.log('Creating suppliers table...');
        
        await client.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            contact_person VARCHAR(255),
            phone VARCHAR(50),
            email VARCHAR(255),
            tax_id VARCHAR(50),
            address TEXT,
            notes TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, user_id)
        )
        `);
        
        // Create indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active)`);

        await client.query('COMMIT');
        console.log('✅ Suppliers table created successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating suppliers table:', error.message);
    } finally {
        client.release();
        pool.end();
    }
  } catch (err) {
      console.error('Connection error:', err);
  }
};

createSuppliersTable();
