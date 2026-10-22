const mongoose = require('mongoose');
const request = require('supertest');
const {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
} = require('./helpers/db');
const { Alert } = require('../src/models/Alert');

const app = require('../src/app');

let mongod;

beforeAll(async () => {
  mongod = await connectTestDb();
  await Alert.init();
}, 120000);

afterAll(async () => {
  await disconnectTestDb(mongod);
});

beforeEach(async () => {
  await clearCollections();
});

function createAlert(overrides = {}) {
  return Alert.create({
    api_name: 'Payments API',
    type: 'FAILED_REQUEST',
    severity: 'critical',
    message: 'Alert message',
    sourceData: { status_code: 500, records_returned: 0 },
    ...overrides,
  });
}

async function seed() {
  const paymentsFailed = await createAlert();
  const paymentsSlow = await createAlert({
    type: 'HIGH_RESPONSE_TIME',
    severity: 'warning',
  });
  const ordersFailed = await createAlert({
    api_name: 'Orders API',
    message: 'Orders alert',
  });
  await createAlert({
    api_name: 'Search API',
    status: 'resolved',
    resolvedAt: new Date(),
    message: 'Resolved alert',
  });

  return { paymentsFailed, paymentsSlow, ordersFailed };
}

describe('GET /alerts', () => {
  it('returns active alerts only', async () => {
    await seed();

    const response = await request(app).get('/alerts').expect(200);

    expect(response.body.count).toBe(3);
    expect(response.body.alerts).toHaveLength(3);
    expect(response.body.alerts.every((alert) => alert.status === 'active')).toBe(true);
  });

  it('filters by severity', async () => {
    await seed();

    const response = await request(app)
      .get('/alerts')
      .query({ severity: 'critical' })
      .expect(200);

    expect(response.body.count).toBe(2);
    expect(response.body.alerts.every((alert) => alert.severity === 'critical')).toBe(true);
  });

  it('filters by api_name and trims it', async () => {
    await seed();

    const response = await request(app)
      .get('/alerts')
      .query({ api_name: '  Payments API  ' })
      .expect(200);

    expect(response.body.count).toBe(2);
    expect(response.body.alerts.every((alert) => alert.api_name === 'Payments API')).toBe(true);
  });

  it('combines filters', async () => {
    await seed();

    const response = await request(app)
      .get('/alerts')
      .query({ api_name: 'Payments API', severity: 'warning' })
      .expect(200);

    expect(response.body.count).toBe(1);
    expect(response.body.alerts[0].type).toBe('HIGH_RESPONSE_TIME');
  });

  it('rejects an unknown severity', async () => {
    const response = await request(app)
      .get('/alerts')
      .query({ severity: 'urgent' })
      .expect(400);

    expect(response.body.error).toBe('severity must be warning or critical');
  });

  it('rejects an empty api_name filter', async () => {
    const response = await request(app)
      .get('/alerts')
      .query({ api_name: '   ' })
      .expect(400);

    expect(response.body.error).toBe('api_name must be a non-empty string');
  });
});

describe('PATCH /alerts/:id/resolve', () => {
  it('resolves an active alert and hides it from the list', async () => {
    const { paymentsFailed } = await seed();

    const response = await request(app)
      .patch(`/alerts/${paymentsFailed._id}/resolve`)
      .expect(200);

    expect(response.body.alert.status).toBe('resolved');
    expect(response.body.alert.resolvedAt).toBeTruthy();

    const list = await request(app).get('/alerts').expect(200);
    expect(list.body.count).toBe(2);
  });

  it('is idempotent', async () => {
    const { paymentsFailed } = await seed();

    const first = await request(app)
      .patch(`/alerts/${paymentsFailed._id}/resolve`)
      .expect(200);
    const second = await request(app)
      .patch(`/alerts/${paymentsFailed._id}/resolve`)
      .expect(200);

    expect(second.body.alert.status).toBe('resolved');
    expect(second.body.alert.resolvedAt).toBe(first.body.alert.resolvedAt);
  });

  it('returns 404 for an unknown alert', async () => {
    const missing = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(`/alerts/${missing}/resolve`)
      .expect(404);

    expect(response.body.error).toBe('Alert not found');
  });

  it('returns 400 for a malformed id', async () => {
    const response = await request(app)
      .patch('/alerts/not-an-id/resolve')
      .expect(400);

    expect(response.body.error).toBe('Invalid alert id');
  });
});
