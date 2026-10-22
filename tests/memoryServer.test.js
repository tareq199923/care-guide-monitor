const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/db');

describe('mongodb-memory-server', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await disconnectTestDb(mongod);
  });

  it('starts and answers a ping', async () => {
    const result = await mongoose.connection.db.admin().ping();
    expect(result.ok).toBe(1);
  });
});
