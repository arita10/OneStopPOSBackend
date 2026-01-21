const pool = require('./src/config/database');

const migrate = async () => {
  try {
    console.log('Starting migration: Adding unit and changing stock type...');

    // 1. Add 'unit' column if it doesn't exist
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'pcs';
    `);
    console.log('✅ Added "unit" column.');

    // 2. Change 'stock' column from INTEGER to DECIMAL(10, 3) to allow for kg (e.g., 1.500)
    // We use ALTER COLUMN with TYPE and a USING clause to convert existing data safely
    await pool.query(`
      ALTER TABLE products 
      ALTER COLUMN stock TYPE DECIMAL(10, 3);
    `);
    console.log('✅ Changed "stock" column to DECIMAL(10, 3).');

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
};

migrate();
