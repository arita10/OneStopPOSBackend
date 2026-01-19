/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message
  });
};

/**
 * Not Found Handler
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`
  });
};

module.exports = { errorHandler, notFound };
