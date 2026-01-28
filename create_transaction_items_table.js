const pool = require('./OneStopPOS_Backend/src/config/database');

const createTransactionItemsTable = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_name TEXT,
        unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
        quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
        subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_by_weight BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transaction_items_user_id ON transaction_items(user_id)`);

    await client.query('COMMIT');
    console.log('transaction_items table created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating table:', err);
  } finally {
    client.release();
    pool.end(); // Close the pool to exit script
  }
};

createTransactionItemsTable();
