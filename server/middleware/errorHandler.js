const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  logger.error("Unhandled error", {
    message: err.message,
    status,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  return res.status(status).json({
    error: isServerError ? "Unexpected server error." : err.message,
  });
};

module.exports = errorHandler;
