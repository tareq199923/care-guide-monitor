const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal server error';
  let details = error.details;

  if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${error.path}`;
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate resource';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON body';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(error.errors).map((item) => item.message);
  }

  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logPayload, stack: error.stack });
    message = 'Internal server error';
    details = undefined;
  } else {
    logger.warn(message, logPayload);
  }

  const body = { error: message };
  if (details !== undefined) {
    body.details = details;
  }

  return res.status(statusCode).json(body);
}

module.exports = errorHandler;
