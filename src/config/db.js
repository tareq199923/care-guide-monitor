const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectMongo(uri = env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', { message: error.message });
  });

  await mongoose.connect(uri);
  logger.info('MongoDB connected', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
  });
}

async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}

module.exports = { connectMongo, disconnectMongo };
