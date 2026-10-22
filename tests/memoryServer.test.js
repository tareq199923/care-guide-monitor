const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('mongodb-memory-server', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    // Mongoose >= 9.10 needs this under Jest; otherwise the handshake
    // omits client metadata because the driver dynamically imports os.
    await mongoose.connect(mongod.getUri(), {
      runtimeAdapters: { os: require('os') },
    });
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('starts and answers a ping', async () => {
    const result = await mongoose.connection.db.admin().ping();
    expect(result.ok).toBe(1);
  });
});
