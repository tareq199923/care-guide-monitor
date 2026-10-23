// --- DNS resolver guard ------------------------------------------------------
// This machine's default Windows DNS resolver cannot answer SRV lookups for
// the Atlas hostname, so `mongoose.connect()` on a mongodb+srv:// URI fails
// with `querySrv ECONNREFUSED`. Point Node's resolver at a LAN + public DNS
// server up front so the SRV record resolves. Harmless on machines whose
// default resolver already works.
const dns = require('node:dns');
dns.setServers(['192.168.0.1', '8.8.8.8']);
// ----------------------------------------------------------------------------

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
