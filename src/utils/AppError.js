class AppError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
