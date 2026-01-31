const { Pool } = require('pg');
require('dotenv').config({ path: './OneStopPOS_Backend/.env' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const isLocal = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

const recreateTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Dropping existing tables...');
    // Drop in reverse order of dependencies
    await client.query('DROP TABLE IF EXISTS kasa_balance_sheet_expenses CASCADE');
    await client.query('DROP TABLE IF EXISTS kasa_expense_types CASCADE');
    await client.query('DROP TABLE IF EXISTS kasa_balance_sheets CASCADE');

    console.log('Creating new tables...');

    // 1. Create expense types table
    await client.query(`
      CREATE TABLE kasa_expense_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ kasa_expense_types created');

    // Insert default expense types
    await client.query(`
      INSERT INTO kasa_expense_types (name, description) VALUES
        ('kasa', 'Cash expenses'),
        ('kart', 'Card expenses'),
        ('devir', 'Carry over expenses')
    `);
    console.log('✓ Default expense types inserted');

    // 2. Create balance sheets table
    await client.query(`
      CREATE TABLE kasa_balance_sheets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        
        -- System Totals
        total_revenue DECIMAL(10, 2) DEFAULT 0,
        total_profit DECIMAL(10, 2) DEFAULT 0,
        
        -- User Inputs/Counts
        total_credit_given DECIMAL(10, 2) DEFAULT 0,
        cash_count DECIMAL(10, 2) DEFAULT 0,
        card_count DECIMAL(10, 2) DEFAULT 0,
        
        -- Expenses (Stored summaries for quick access)
        cash_expense_total DECIMAL(10, 2) DEFAULT 0,
        card_expense_total DECIMAL(10, 2) DEFAULT 0,
        
        -- Calculated Fields
        calculated_diff DECIMAL(10, 2) DEFAULT 0, -- total_revenue - (cash_count + total_credit_given + card_count + cash_expense_total)
        
        -- Devir / Carry Over Logic
        previous_devir DECIMAL(10, 2) DEFAULT 0, -- Yesterday's total_devir
        total_devir DECIMAL(10, 2) DEFAULT 0,    -- cash_count + previous_devir
        
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, date)
      )
    `);
    console.log('✓ kasa_balance_sheets created');

    // 3. Create balance sheet expenses table
    await client.query(`
      CREATE TABLE kasa_balance_sheet_expenses (
        id SERIAL PRIMARY KEY,
        balance_sheet_id INTEGER NOT NULL REFERENCES kasa_balance_sheets(id) ON DELETE CASCADE,
        expense_type_id INTEGER NOT NULL REFERENCES kasa_expense_types(id),
        description VARCHAR(255),
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ kasa_balance_sheet_expenses created');

    // Create indexes
    await client.query(`CREATE INDEX idx_kasa_balance_sheets_user_date ON kasa_balance_sheets(user_id, date)`);
    await client.query(`CREATE INDEX idx_kasa_balance_sheet_expenses_sheet ON kasa_balance_sheet_expenses(balance_sheet_id)`);
    await client.query(`CREATE INDEX idx_kasa_balance_sheet_expenses_type ON kasa_balance_sheet_expenses(expense_type_id)`);
    console.log('✓ Indexes created');

    await client.query('COMMIT');
    console.log('\n✅ Database tables recreated successfully with new schema!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recreating tables:', error);
  } finally {
    client.release();
    await pool.end();
  }
};

recreateTables();
