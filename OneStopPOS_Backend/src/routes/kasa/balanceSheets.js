const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/kasa/balance-sheets
 * Get all balance sheets with optional date range filter
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { start_date, end_date, limit = 100, offset = 0 } = req.query;

  let query = 'SELECT * FROM balance_sheets WHERE user_id = $1';
  const params = [userId];
  let paramCount = 1;

  if (start_date) {
    paramCount++;
    query += ` AND date >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND date <= $${paramCount}`;
    params.push(end_date);
  }

  query += ' ORDER BY date DESC';

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(parseInt(limit));

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(parseInt(offset));

  const result = await pool.query(query, params);

  // Get total count with same filters
  let countQuery = 'SELECT COUNT(*) FROM balance_sheets WHERE user_id = $1';
  const countParams = [userId];
  let countParamNum = 1;

  if (start_date) {
    countParamNum++;
    countQuery += ` AND date >= $${countParamNum}`;
    countParams.push(start_date);
  }

  if (end_date) {
    countParamNum++;
    countQuery += ` AND date <= $${countParamNum}`;
    countParams.push(end_date);
  }

  const countResult = await pool.query(countQuery, countParams);

  res.json({
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/kasa/balance-sheets/:date
 * Get balance sheet by date with all expense types
 */
router.get('/:date', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { date } = req.params;

  // Get balance sheet
  const sheetResult = await pool.query(
    'SELECT * FROM balance_sheets WHERE date = $1 AND user_id = $2',
    [date, userId]
  );

  if (sheetResult.rows.length === 0) {
    // Return empty template with system data
    const systemData = await getSystemDataForDate(date);
    const yesterdayDevir = await getYesterdayKalanDevir(userId, date);

    return res.json({
      date,
      exists: false,
      system_data: systemData,
      yesterday_kalan_devir: yesterdayDevir,
      balance_sheet: null,
      expense_types: []
    });
  }

  const balanceSheet = sheetResult.rows[0];

  // Get expense types with type and supplier info
  const expenseTypesResult = await pool.query(
    `SELECT
       e.*,
       et.name as expense_type_name,
       s.name as supplier_name
     FROM balance_sheet_expenses e
     LEFT JOIN expense_types et ON e.expense_type_id = et.id
     LEFT JOIN suppliers s ON e.supplier_id = s.id
     WHERE e.balance_sheet_id = $1
     ORDER BY et.name, e.created_at`,
    [balanceSheet.id]
  );

  res.json({
    date,
    exists: true,
    balance_sheet: balanceSheet,
    expense_types: expenseTypesResult.rows
  });
}));

/**
 * GET /api/kasa/balance-sheets/:date/system-data
 * Get system calculated data for a date (revenue, profit from transactions)
 */
router.get('/:date/system-data', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const userId = req.user.id;

  const systemData = await getSystemDataForDate(date);
  const yesterdayDevir = await getYesterdayKalanDevir(userId, date);

  res.json({
    date,
    ...systemData,
    yesterday_kalan_devir: yesterdayDevir
  });
}));

/**
 * POST /api/kasa/balance-sheets
 * Create or update a balance sheet with expenses
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    date,
    cash_count,
    card_count,
    credit_given,
    notes,
    expenses // Array of { expense_type_id, supplier_id, description, amount }
  } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get system data
    const systemData = await getSystemDataForDate(date);
    const yesterdayDevir = await getYesterdayKalanDevir(userId, date);

    // Calculate expense totals by type
    let totalCashExpense = 0;
    let totalCardExpense = 0;
    let totalDevirExpense = 0;

    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        // Get expense type name
        const typeResult = await client.query(
          'SELECT name FROM expense_types WHERE id = $1',
          [exp.expense_type_id]
        );

        if (typeResult.rows.length > 0) {
          const typeName = typeResult.rows[0].name.toLowerCase();
          const amount = parseFloat(exp.amount) || 0;

          if (typeName === 'kasa') {
            totalCashExpense += amount;
          } else if (typeName === 'kart') {
            totalCardExpense += amount;
          } else if (typeName === 'devir') {
            totalDevirExpense += amount;
          }
        }
      }
    }

    // Calculate difference and total_devir
    const cashCountVal = parseFloat(cash_count) || 0;
    const cardCountVal = parseFloat(card_count) || 0;
    const creditGivenVal = parseFloat(credit_given) || 0;
    const totalRevenue = parseFloat(systemData.total_revenue) || 0;

    // difference = total_revenue - (cash_count + credit_given + card_count + total_cash_expense)
    const difference = totalRevenue - (cashCountVal + creditGivenVal + cardCountVal + totalCashExpense);

    // total_devir = cash_count + yesterday_kalan_devir
    const totalDevir = cashCountVal + yesterdayDevir;

    // Check if balance sheet exists
    const existingResult = await client.query(
      'SELECT id FROM balance_sheets WHERE date = $1 AND user_id = $2',
      [date, userId]
    );

    let balanceSheet;

    if (existingResult.rows.length > 0) {
      // Update existing
      const updateResult = await client.query(
        `UPDATE balance_sheets
         SET total_revenue = $1,
             total_profit = $2,
             cash_count = $3,
             card_count = $4,
             credit_given = $5,
             total_cash_expense = $6,
             total_card_expense = $7,
             total_devir_expense = $8,
             difference = $9,
             yesterday_kalan_devir = $10,
             total_devir = $11,
             notes = $12,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $13
         RETURNING *`,
        [
          systemData.total_revenue,
          systemData.total_profit,
          cashCountVal,
          cardCountVal,
          creditGivenVal,
          totalCashExpense,
          totalCardExpense,
          totalDevirExpense,
          difference,
          yesterdayDevir,
          totalDevir,
          notes || null,
          existingResult.rows[0].id
        ]
      );
      balanceSheet = updateResult.rows[0];

      // Delete old expense types
      await client.query(
        'DELETE FROM balance_sheet_expenses WHERE balance_sheet_id = $1',
        [balanceSheet.id]
      );
    } else {
      // Create new
      const insertResult = await client.query(
        `INSERT INTO balance_sheets
         (user_id, date, total_revenue, total_profit, cash_count, card_count, credit_given,
          total_cash_expense, total_card_expense, total_devir_expense, difference,
          yesterday_kalan_devir, total_devir, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          userId,
          date,
          systemData.total_revenue,
          systemData.total_profit,
          cashCountVal,
          cardCountVal,
          creditGivenVal,
          totalCashExpense,
          totalCardExpense,
          totalDevirExpense,
          difference,
          yesterdayDevir,
          totalDevir,
          notes || null
        ]
      );
      balanceSheet = insertResult.rows[0];
    }

    // Insert expense types
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        await client.query(
          `INSERT INTO balance_sheet_expenses
           (balance_sheet_id, expense_type_id, supplier_id, description, amount)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            balanceSheet.id,
            exp.expense_type_id,
            exp.supplier_id || null,
            exp.description || null,
            parseFloat(exp.amount) || 0
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Get expense types with type and supplier names
    const expenseTypesWithNames = await pool.query(
      `SELECT
         e.*,
         et.name as expense_type_name,
         s.name as supplier_name
       FROM balance_sheet_expenses e
       LEFT JOIN expense_types et ON e.expense_type_id = et.id
       LEFT JOIN suppliers s ON e.supplier_id = s.id
       WHERE e.balance_sheet_id = $1
       ORDER BY et.name, e.created_at`,
      [balanceSheet.id]
    );

    res.status(existingResult.rows.length > 0 ? 200 : 201).json({
      balance_sheet: balanceSheet,
      expense_types: expenseTypesWithNames.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * DELETE /api/kasa/balance-sheets/:date
 * Delete a balance sheet and its expenses
 */
router.delete('/:date', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { date } = req.params;

  const result = await pool.query(
    'DELETE FROM balance_sheets WHERE date = $1 AND user_id = $2 RETURNING *',
    [date, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Balance sheet not found' });
  }

  res.json({ message: 'Balance sheet deleted successfully' });
}));

/**
 * Helper: Get system data for a date (from transactions)
 */
async function getSystemDataForDate(date) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(total_amount), 0) as total_revenue,
       COALESCE(SUM(total_profit), 0) as total_profit,
       COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
       COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total_amount ELSE 0 END), 0) as credit_sales,
       COUNT(*) as transaction_count
     FROM transactions
     WHERE DATE(created_at) = $1 AND status != 'voided'`,
    [date]
  );

  return {
    total_revenue: parseFloat(result.rows[0].total_revenue) || 0,
    total_profit: parseFloat(result.rows[0].total_profit) || 0,
    cash_sales: parseFloat(result.rows[0].cash_sales) || 0,
    card_sales: parseFloat(result.rows[0].card_sales) || 0,
    credit_sales: parseFloat(result.rows[0].credit_sales) || 0,
    transaction_count: parseInt(result.rows[0].transaction_count) || 0
  };
}

/**
 * Helper: Get yesterday's kalan devir (total_devir from previous day)
 */
async function getYesterdayKalanDevir(userId, date) {
  const result = await pool.query(
    `SELECT total_devir
     FROM balance_sheets
     WHERE user_id = $1 AND date < $2
     ORDER BY date DESC
     LIMIT 1`,
    [userId, date]
  );

  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].total_devir) || 0;
  }

  return 0;
}

module.exports = router;
