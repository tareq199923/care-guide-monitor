const fs = require('fs');
const path = require('path');
const winston = require('winston');
const env = require('../config/env');

const logDir = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${extra}`;
  }),
);

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: fileFormat,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      level: 'info',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
  ],
});

module.exports = logger;
