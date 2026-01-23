/**
 * Database Initialization Script
 *
 * This script creates all the required tables for the OneStopPOS system.
 * Run with: npm run db:init
 *
 * TABLE EXPLANATIONS:
 *
 * 1. products - Stores all product/inventory information
 *    - id: Unique identifier for each product
 *    - name: Product name
 *    - barcode: Unique barcode for scanning
 *    - price: Selling price of the product
 *    - cost: Cost price (for profit calculation)
 *    - stock: Current quantity in inventory
 *    - category: Product category for organization
 *    - description: Optional product description
 *    - image_url: Optional product image
 *    - is_active: Soft delete flag
 *    - created_at/updated_at: Timestamps
 *
 * 2. transactions - Records all POS sales transactions
 *    - id: Unique transaction identifier
 *    - items: JSON array of items sold (product_id, name, quantity, price, subtotal)
 *    - subtotal: Sum of all items before discount
 *    - discount: Discount amount applied
 *    - tax: Tax amount
 *    - total: Final transaction amount
 *    - payment_method: cash, card, credit, etc.
 *    - amount_paid: Amount given by customer
 *    - change_amount: Change returned to customer
 *    - status: completed, voided, refunded
 *    - notes: Optional transaction notes
 *    - cashier_id: Who processed the transaction
 *    - created_at: When transaction occurred
 *
 * 3. verisiye_customers - Credit customers (Verisiye = credit sales in Turkish)
 *    - id: Unique customer identifier
 *    - name: Customer full name
 *    - house_no: House/apartment number for identification
 *    - phone: Contact phone number
 *    - address: Full address
 *    - email: Optional email
 *    - credit_limit: Maximum allowed credit
 *    - current_balance: Current outstanding balance (positive = owes money)
 *    - notes: Customer notes
 *    - is_active: Soft delete flag
 *    - created_at/updated_at: Timestamps
 *
 * 4. verisiye_transactions - Credit transactions for customers
 *    - id: Unique identifier
 *    - customer_id: Links to verisiye_customers
 *    - type: 'credit' (purchase on credit) or 'payment' (payment received)
 *    - amount: Transaction amount
 *    - description: What was purchased or payment note
 *    - reference_id: Optional link to main transaction
 *    - balance_after: Customer balance after this transaction
 *    - created_at: When transaction occurred
 *
 * 5. kasa_expense_products - Predefined expense categories for daily cash register
 *    - id: Unique identifier
 *    - name: Expense name (e.g., "Rent", "Utilities", "Supplies")
 *    - category: 'kasa' (cash), 'kart' (card), 'devir' (carryover)
 *    - description: Optional description
 *    - is_active: Soft delete flag
 *    - created_at/updated_at: Timestamps
 *
 * 6. kasa_balance_sheets - Daily cash register balance sheets
 *    - id: Unique identifier
 *    - date: The date of the balance sheet (unique per day)
 *    - items: JSON array of expense items with amounts
 *    - opening_balance: Cash at start of day
 *    - total_sales: Total sales for the day
 *    - total_expenses: Total expenses for the day
 *    - total_card_sales: Card payment totals
 *    - total_cash_sales: Cash payment totals
 *    - closing_balance: Cash at end of day
 *    - notes: Optional notes for the day
 *    - created_at/updated_at: Timestamps
 *
 * 7. users - System users with authentication
 *    - id: Unique identifier
 *    - username: Unique username for login
 *    - email: User email address
 *    - password: Hashed password (bcrypt)
 *    - full_name: User's full name
 *    - role: 'admin' or 'user' (admin has full access, user has limited)
 *    - is_active: Account active status
 *    - last_login: Last login timestamp
 *    - created_at/updated_at: Timestamps
 */

const pool = require('./database');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        barcode VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(100),
        description TEXT,
        image_url VARCHAR(500),
        unit VARCHAR(20) DEFAULT 'pcs',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(barcode, user_id)
      )
    `);
    console.log('✓ Products table created');

    // 2. Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        items JSONB NOT NULL DEFAULT '[]',
        subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
        discount DECIMAL(10, 2) DEFAULT 0,
        tax DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
        amount_paid DECIMAL(10, 2) DEFAULT 0,
        change_amount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        notes TEXT,
        cashier_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Transactions table created');

    // 3. Verisiye Customers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS verisiye_customers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        house_no VARCHAR(50),
        phone VARCHAR(50),
        address TEXT,
        email VARCHAR(255),
        credit_limit DECIMAL(10, 2) DEFAULT 0,
        current_balance DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Verisiye Customers table created');

    // 4. Verisiye Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS verisiye_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES verisiye_customers(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'payment')),
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        reference_id INTEGER,
        balance_after DECIMAL(10, 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Verisiye Transactions table created');

    // 5. Kasa Expense Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS kasa_expense_products (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('kasa', 'kart', 'devir')),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Kasa Expense Products table created');

    // 6. Kasa Balance Sheets Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS kasa_balance_sheets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        items JSONB NOT NULL DEFAULT '[]',
        opening_balance DECIMAL(10, 2) DEFAULT 0,
        total_sales DECIMAL(10, 2) DEFAULT 0,
        total_expenses DECIMAL(10, 2) DEFAULT 0,
        total_card_sales DECIMAL(10, 2) DEFAULT 0,
        total_cash_sales DECIMAL(10, 2) DEFAULT 0,
        closing_balance DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, user_id)
      )
    `);
    console.log('✓ Kasa Balance Sheets table created');

    // 7. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');

    // Create default admin user if not exists
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role)
      VALUES ('admin', 'admin@onestoppos.com', $1, 'System Administrator', 'admin')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    console.log('✓ Default admin user created (username: admin, password: admin123)');

    // Create indexes for better query performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_customers_user_id ON verisiye_customers(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_customers_house_no ON verisiye_customers(house_no)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_customers_name ON verisiye_customers(name)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_transactions_user_id ON verisiye_transactions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_transactions_customer_id ON verisiye_transactions(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_transactions_created_at ON verisiye_transactions(created_at)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kasa_expense_products_user_id ON kasa_expense_products(user_id)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kasa_balance_sheets_user_id ON kasa_balance_sheets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kasa_balance_sheets_date ON kasa_balance_sheets(date)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    console.log('✓ Indexes created');

    await client.query('COMMIT');
    console.log('\n✅ Database initialization completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables().catch(console.error);
