const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  console.log('In-memory Mongo started at', mongod.getUri());
  // Keep process alive; server.js handles SIGINT shutdown
  process.on('SIGINT', async () => {
    await mongod.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await mongod.stop();
    process.exit(0);
  });
  require('../src/server');
})().catch((error) => {
  console.error('Failed to start the in-memory development database', error);
  process.exit(1);
});
