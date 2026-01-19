const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * POST /api/verisiye/whatsapp/send/:customerId
 * Send WhatsApp message to a single customer
 * Note: This is a placeholder - actual WhatsApp integration requires third-party service
 */
router.post('/send/:customerId', asyncHandler(async (req, res) => {
  const { customerId } = req.params;

  // Get customer details
  const customerResult = await pool.query(
    'SELECT * FROM verisiye_customers WHERE id = $1 AND is_active = true',
    [customerId]
  );

  if (customerResult.rows.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const customer = customerResult.rows[0];

  if (!customer.phone) {
    return res.status(400).json({ error: 'Customer does not have a phone number' });
  }

  // Get recent transactions for the customer
  const transactionsResult = await pool.query(
    `SELECT * FROM verisiye_transactions
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [customerId]
  );

  // Generate message content
  const message = generateWhatsAppMessage(customer, transactionsResult.rows);

  // In a real implementation, you would integrate with WhatsApp Business API
  // For now, we return the generated message and a placeholder response

  res.json({
    success: true,
    message: 'WhatsApp message prepared (integration pending)',
    customer_id: customer.id,
    customer_name: customer.name,
    phone: customer.phone,
    current_balance: customer.current_balance,
    generated_message: message
  });
}));

/**
 * POST /api/verisiye/whatsapp/send-bulk
 * Send WhatsApp messages to multiple customers
 */
router.post('/send-bulk', asyncHandler(async (req, res) => {
  const { customer_ids, min_credit_amount } = req.body;

  let query = `
    SELECT * FROM verisiye_customers
    WHERE is_active = true
    AND phone IS NOT NULL
    AND phone != ''
  `;
  const params = [];

  if (customer_ids && Array.isArray(customer_ids) && customer_ids.length > 0) {
    query += ` AND id = ANY($1)`;
    params.push(customer_ids);
  } else if (min_credit_amount) {
    query += ` AND current_balance >= $1`;
    params.push(min_credit_amount);
  }

  query += ' ORDER BY current_balance DESC';

  const customersResult = await pool.query(query, params);

  if (customersResult.rows.length === 0) {
    return res.status(404).json({
      error: 'No customers found matching the criteria'
    });
  }

  const results = [];

  for (const customer of customersResult.rows) {
    // Get recent transactions for each customer
    const transactionsResult = await pool.query(
      `SELECT * FROM verisiye_transactions
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [customer.id]
    );

    const message = generateWhatsAppMessage(customer, transactionsResult.rows);

    results.push({
      customer_id: customer.id,
      customer_name: customer.name,
      phone: customer.phone,
      current_balance: customer.current_balance,
      status: 'prepared',
      generated_message: message
    });
  }

  res.json({
    success: true,
    message: `WhatsApp messages prepared for ${results.length} customers (integration pending)`,
    total_customers: results.length,
    total_outstanding: customersResult.rows.reduce(
      (sum, c) => sum + parseFloat(c.current_balance || 0), 0
    ),
    results
  });
}));

/**
 * Helper function to generate WhatsApp message
 */
function generateWhatsAppMessage(customer, transactions) {
  const balance = parseFloat(customer.current_balance || 0);
  const formattedBalance = balance.toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  });

  let message = `Merhaba ${customer.name},\n\n`;
  message += `Mevcut borcunuz: ${formattedBalance}\n\n`;

  if (transactions && transactions.length > 0) {
    message += `Son işlemler:\n`;
    transactions.slice(0, 5).forEach(t => {
      const date = new Date(t.created_at).toLocaleDateString('tr-TR');
      const amount = parseFloat(t.amount).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY'
      });
      const type = t.type === 'credit' ? 'Alışveriş' : 'Ödeme';
      message += `- ${date}: ${type} ${amount}\n`;
    });
  }

  message += `\nTeşekkür ederiz.`;

  return message;
}

module.exports = router;
