/**
 * OneStopPOS Backend API Server
 * Main entry point for the application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const transactionRoutes = require('./routes/transactions');
const verisiyeCustomerRoutes = require('./routes/verisiye/customers');
const verisiyeTransactionRoutes = require('./routes/verisiye/transactions');
const verisiyeReportRoutes = require('./routes/verisiye/reports');
const verisiyeWhatsappRoutes = require('./routes/verisiye/whatsapp');
const kasaExpenseProductRoutes = require('./routes/kasa/expenseProducts');
const kasaBalanceSheetRoutes = require('./routes/kasa/balanceSheets');
const kasaReportRoutes = require('./routes/kasa/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' })); // CORS
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
// Health check at root (not /api/health)
app.use('/health', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/verisiye/customers', verisiyeCustomerRoutes);
app.use('/api/verisiye/transactions', verisiyeTransactionRoutes);
app.use('/api/verisiye/reports', verisiyeReportRoutes);
app.use('/api/verisiye/whatsapp', verisiyeWhatsappRoutes);
app.use('/api/kasa/expense-products', kasaExpenseProductRoutes);
app.use('/api/kasa/balance-sheets', kasaBalanceSheetRoutes);
app.use('/api/kasa/reports', kasaReportRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'OneStopPOS Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      products: '/api/products',
      transactions: '/api/transactions',
      verisiye: {
        customers: '/api/verisiye/customers',
        transactions: '/api/verisiye/transactions',
        reports: '/api/verisiye/reports',
        whatsapp: '/api/verisiye/whatsapp'
      },
      kasa: {
        expenseProducts: '/api/kasa/expense-products',
        balanceSheets: '/api/kasa/balance-sheets',
        reports: '/api/kasa/reports'
      }
    }
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     OneStopPOS Backend API Server                         ║
║                                                           ║
║     Server running on port ${PORT}                          ║
║     Environment: ${process.env.NODE_ENV || 'development'}                        ║
║                                                           ║
║     Endpoints:                                            ║
║     - GET  /health                 Health check           ║
║     - POST /api/auth/login         User login             ║
║     - GET  /api/products           Products API           ║
║     - GET  /api/transactions       Transactions API       ║
║     - GET  /api/verisiye/*         Credit System API      ║
║     - GET  /api/kasa/*             Cash Register API      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
