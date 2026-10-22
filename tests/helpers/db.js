const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function connectTestDb() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), {
    // Mongoose >= 9.10 needs this under Jest; otherwise the handshake
    // omits client metadata because the driver dynamically imports os.
    runtimeAdapters: { os: require('os') },
  });
  return mongod;
}

async function disconnectTestDb(mongod) {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}

async function clearCollections() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

module.exports = {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
};
