const request = require('supertest');
const {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
} = require('./helpers/db');
const { Alert } = require('../src/models/Alert');
const { ApiState } = require('../src/models/ApiState');
const aiAlert = require('../src/services/aiAlert');
const sampleData = require('../sample-data.json');

jest.mock('../src/services/aiAlert', () => ({
  generateMessage: jest.fn(),
}));

const app = require('../src/app');

let mongod;

beforeAll(async () => {
  mongod = await connectTestDb();
  await Promise.all([Alert.init(), ApiState.init()]);
}, 120000);

afterAll(async () => {
  await disconnectTestDb(mongod);
});

beforeEach(async () => {
  await clearCollections();
  aiAlert.generateMessage.mockReset();
  aiAlert.generateMessage.mockResolvedValue({
    message: 'AI alert.',
    aiGenerated: true,
  });
});

describe('POST /monitor', () => {
  it('accepts a healthy batch without creating alerts', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([{
        api_name: 'Payments API',
        response_time_ms: 120,
        status_code: 200,
        records_returned: 50,
      }])
      .expect(200);

    expect(response.body).toEqual({
      received: 1,
      processed: 1,
      created: 0,
      updated: 0,
      errors: [],
    });
    await expect(Alert.countDocuments()).resolves.toBe(0);

    const state = await ApiState.findOne({ api_name: 'Payments API' }).lean();
    expect(state.consecutiveFailures).toBe(0);
  });

  it('creates an alert for a slow API and trims api_name', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([{
        api_name: '  Payments API  ',
        response_time_ms: 4200,
        status_code: 200,
        records_returned: 50,
      }])
      .expect(200);

    expect(response.body.created).toBe(1);

    const alert = await Alert.findOne({ api_name: 'Payments API' }).lean();
    expect(alert.type).toBe('HIGH_RESPONSE_TIME');
    expect(alert.severity).toBe('warning');
    expect(alert.message).toBe('AI alert.');
    expect(alert.aiGenerated).toBe(true);
  });

  it('does not create NO_RECORDS for a failed request', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([{
        api_name: 'Payments API',
        response_time_ms: 120,
        status_code: 500,
        records_returned: 0,
      }])
      .expect(200);

    expect(response.body.created).toBe(1);

    const types = await Alert.distinct('type');
    expect(types).toEqual(['FAILED_REQUEST']);
  });

  it('creates INVALID_DATA for bad metric fields', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([{
        api_name: 'Bad API',
        response_time_ms: 100,
        status_code: '500',
        records_returned: 5,
      }])
      .expect(200);

    expect(response.body.created).toBe(1);

    const alert = await Alert.findOne({ api_name: 'Bad API' }).lean();
    expect(alert.type).toBe('INVALID_DATA');
    expect(alert.sourceData.status_code).toBeNull();
    expect(alert.sourceData.issues).toContain(
      'status_code must be an integer between 100 and 599',
    );
  });

  it('rejects a batch when an item has no usable api_name', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([
        {
          api_name: 'Payments API',
          response_time_ms: 120,
          status_code: 200,
          records_returned: 50,
        },
        { response_time_ms: 100 },
      ])
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual([
      { index: 1, message: 'api_name must be a non-empty string' },
    ]);
    await expect(Alert.countDocuments()).resolves.toBe(0);
  });

  it('rejects a batch when an api_name is too long', async () => {
    const response = await request(app)
      .post('/monitor')
      .send([{
        api_name: 'x'.repeat(201),
        response_time_ms: 120,
        status_code: 200,
        records_returned: 50,
      }])
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual([
      { index: 0, message: 'api_name must be 200 characters or fewer' },
    ]);
    await expect(Alert.countDocuments()).resolves.toBe(0);
  });

  it('rejects a body that is not a non-empty array', async () => {
    const response = await request(app)
      .post('/monitor')
      .send({ api_name: 'Payments API' })
      .expect(400);

    expect(response.body.error).toBe(
      'Request body must be a non-empty array of check results',
    );
  });

  it('tracks repeated failures and resets after a healthy check', async () => {
    const failing = [{
      api_name: 'Repeat API',
      response_time_ms: 100,
      status_code: 500,
      records_returned: 0,
    }];

    const first = await request(app).post('/monitor').send(failing).expect(200);
    expect(first.body).toMatchObject({ created: 1, updated: 0 });

    const second = await request(app).post('/monitor').send(failing).expect(200);
    expect(second.body).toMatchObject({ created: 0, updated: 1 });

    const third = await request(app).post('/monitor').send(failing).expect(200);
    expect(third.body).toMatchObject({ created: 1, updated: 1 });

    const alerts = await Alert.find({ api_name: 'Repeat API' }).lean();
    expect(alerts).toHaveLength(2);

    const failed = alerts.find((alert) => alert.type === 'FAILED_REQUEST');
    const repeated = alerts.find((alert) => alert.type === 'REPEATED_FAILURE');
    expect(failed.occurrences).toBe(3);
    expect(failed.severity).toBe('critical');
    expect(repeated.severity).toBe('critical');
    expect(repeated.consecutiveFailures).toBe(3);

    const state = await ApiState.findOne({ api_name: 'Repeat API' }).lean();
    expect(state.consecutiveFailures).toBe(3);

    await request(app)
      .post('/monitor')
      .send([{
        api_name: 'Repeat API',
        response_time_ms: 100,
        status_code: 200,
        records_returned: 10,
      }])
      .expect(200);

    const resetState = await ApiState.findOne({ api_name: 'Repeat API' }).lean();
    expect(resetState.consecutiveFailures).toBe(0);
  });

  it('handles multiple checks for the same new API in one batch', async () => {
    const failing = {
      api_name: 'Repeat API',
      response_time_ms: 100,
      status_code: 500,
      records_returned: 0,
    };

    const response = await request(app)
      .post('/monitor')
      .send([failing, failing, failing])
      .expect(200);

    expect(response.body).toEqual({
      received: 3,
      processed: 3,
      created: 2,
      updated: 2,
      errors: [],
    });

    const state = await ApiState.findOne({ api_name: 'Repeat API' }).lean();
    expect(state.consecutiveFailures).toBe(3);

    const failed = await Alert.findOne({
      api_name: 'Repeat API',
      type: 'FAILED_REQUEST',
    }).lean();
    expect(failed.occurrences).toBe(3);
    expect(failed.severity).toBe('critical');
  });

  it('accepts the checked-in sample data batch', async () => {
    const response = await request(app)
      .post('/monitor')
      .send(sampleData)
      .expect(200);

    expect(response.body.received).toBe(sampleData.length);
    expect(response.body.processed).toBe(sampleData.length);
    expect(response.body.errors).toEqual([]);

    const repeated = await Alert.findOne({
      api_name: 'Reports API',
      type: 'REPEATED_FAILURE',
    }).lean();
    expect(repeated).toBeDefined();
    expect(repeated.consecutiveFailures).toBe(3);
  });

  it('limits concurrent LLM calls to five', async () => {
    let active = 0;
    let maxActive = 0;

    aiAlert.generateMessage.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 25));
      active -= 1;
      return { message: 'AI alert.', aiGenerated: true };
    });

    const items = Array.from({ length: 12 }, (_, index) => ({
      api_name: `API ${index}`,
      response_time_ms: 4200,
      status_code: 200,
      records_returned: 10,
    }));

    const response = await request(app)
      .post('/monitor')
      .send(items)
      .expect(200);

    expect(response.body.created).toBe(12);
    expect(maxActive).toBeLessThanOrEqual(5);
    expect(maxActive).toBeGreaterThan(1);
  });
});
