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

  try {
    await mongoose.connect(uri);
  } catch (error) {
    // Surface the DNS / network cause with an actionable hint so the user is
    // not left with a bare `querySrv ECONNREFUSED`.
    if (error && (error.message.includes('querySrv') || error.code === 'ECONNREFUSED' || error.code === 'EAI_AGAIN')) {
      throw new Error(
        `Could not resolve/reach MongoDB Atlas host. ` +
        `Check your network connection, ensure the Atlas IP allowlist permits this machine, ` +
        `and that DNS can resolve ${uri.split('@').pop().split('?')[0]}. ` +
        `Original error: ${error.message}`
      );
    }
    throw error;
  }

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
