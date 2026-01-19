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
 */

const pool = require('./database');

const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        barcode VARCHAR(100) UNIQUE,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(100),
        description TEXT,
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Products table created');

    // 2. Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
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
        date DATE NOT NULL UNIQUE,
        items JSONB NOT NULL DEFAULT '[]',
        opening_balance DECIMAL(10, 2) DEFAULT 0,
        total_sales DECIMAL(10, 2) DEFAULT 0,
        total_expenses DECIMAL(10, 2) DEFAULT 0,
        total_card_sales DECIMAL(10, 2) DEFAULT 0,
        total_cash_sales DECIMAL(10, 2) DEFAULT 0,
        closing_balance DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Kasa Balance Sheets table created');

    // Create indexes for better query performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_customers_house_no ON verisiye_customers(house_no)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_customers_name ON verisiye_customers(name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_transactions_customer_id ON verisiye_transactions(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_verisiye_transactions_created_at ON verisiye_transactions(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kasa_balance_sheets_date ON kasa_balance_sheets(date)`);
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
