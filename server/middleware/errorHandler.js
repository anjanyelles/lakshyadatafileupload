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
    requestId: req.requestId,
  });

  return res.status(status).json({
    error: isServerError ? "Unexpected server error." : err.message,
    requestId: req.requestId,
  });
};

module.exports = errorHandler;
