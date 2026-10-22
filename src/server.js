const app = require('./app');
const env = require('./config/env');
const { connectMongo, disconnectMongo } = require('./config/db');
const logger = require('./utils/logger');

let server;

async function shutdown(signal) {
  logger.info('Shutting down', { signal });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await disconnectMongo();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

async function start() {
  await connectMongo();
  server = app.listen(env.PORT, () => {
    logger.info('Server started', { port: env.PORT });
  });
}

start().catch((error) => {
  logger.error('Failed to start', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
