const mongoose = require('mongoose');
const {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
} = require('./helpers/db');
const { Alert } = require('../src/models/Alert');
const {
  recordAnomaly,
  listAlerts,
  resolveAlert,
} = require('../src/services/alertPolicy');
const aiAlert = require('../src/services/aiAlert');

jest.mock('../src/services/aiAlert', () => ({
  generateMessage: jest.fn(),
}));

const item = {
  api_name: 'Payments API',
  response_time_ms: 120,
  status_code: 500,
  records_returned: 0,
};

const failedRequest = { type: 'FAILED_REQUEST', severity: 'critical' };

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
  aiAlert.generateMessage.mockReset();
  aiAlert.generateMessage.mockResolvedValue({
    message: 'Payments API is failing.',
    aiGenerated: true,
  });
});

describe('recordAnomaly', () => {
  it('creates a new active alert with a source snapshot', async () => {
    const { alert, created } = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });

    expect(created).toBe(true);
    expect(alert.status).toBe('active');
    expect(alert.message).toBe('Payments API is failing.');
    expect(alert.aiGenerated).toBe(true);
    expect(alert.occurrences).toBe(1);
    expect(alert.sourceData.status_code).toBe(500);
    expect(alert.sourceData.records_returned).toBe(0);
    expect(aiAlert.generateMessage).toHaveBeenCalledTimes(1);
  });

  it('updates an active duplicate instead of creating another', async () => {
    await recordAnomaly(item, failedRequest, { consecutiveFailures: 1 });

    const { alert, created } = await recordAnomaly(
      { ...item, response_time_ms: 450, status_code: 503 },
      failedRequest,
      { consecutiveFailures: 2 },
    );

    expect(created).toBe(false);
    expect(alert.occurrences).toBe(2);
    expect(alert.consecutiveFailures).toBe(2);
    expect(alert.sourceData.status_code).toBe(503);
    expect(alert.sourceData.response_time_ms).toBe(450);
    expect(alert.message).toBe('Payments API is failing.');
    expect(aiAlert.generateMessage).toHaveBeenCalledTimes(1);
    await expect(Alert.countDocuments()).resolves.toBe(1);
  });

  it('escalates severity but never downgrades it', async () => {
    await recordAnomaly(
      { ...item, status_code: 404 },
      { type: 'FAILED_REQUEST', severity: 'warning' },
      { consecutiveFailures: 1 },
    );

    const escalated = await recordAnomaly(
      { ...item, status_code: 500 },
      failedRequest,
      { consecutiveFailures: 2 },
    );
    expect(escalated.alert.severity).toBe('critical');

    const downgraded = await recordAnomaly(
      { ...item, status_code: 404 },
      { type: 'FAILED_REQUEST', severity: 'warning' },
      { consecutiveFailures: 1 },
    );
    expect(downgraded.alert.severity).toBe('critical');
  });

  it('tracks different anomaly types as separate alerts', async () => {
    await recordAnomaly(item, failedRequest, { consecutiveFailures: 1 });

    const slow = await recordAnomaly(
      { ...item, status_code: 200, response_time_ms: 4200 },
      { type: 'HIGH_RESPONSE_TIME', severity: 'warning' },
      { consecutiveFailures: 0 },
    );

    expect(slow.created).toBe(true);
    expect(aiAlert.generateMessage).toHaveBeenCalledTimes(2);
    await expect(Alert.countDocuments()).resolves.toBe(2);
  });

  it('stores the fallback flag when the AI service falls back', async () => {
    aiAlert.generateMessage.mockResolvedValue({
      message: 'Template message.',
      aiGenerated: false,
    });

    const { alert } = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });

    expect(alert.aiGenerated).toBe(false);
    expect(alert.message).toBe('Template message.');
  });
});

describe('listAlerts', () => {
  it('returns active alerts filtered by severity and api_name', async () => {
    await recordAnomaly(item, failedRequest, { consecutiveFailures: 1 });
    await recordAnomaly(
      { ...item, status_code: 200, response_time_ms: 4200 },
      { type: 'HIGH_RESPONSE_TIME', severity: 'warning' },
      { consecutiveFailures: 0 },
    );
    await recordAnomaly(
      { ...item, api_name: 'Orders API' },
      failedRequest,
      { consecutiveFailures: 1 },
    );

    await expect(listAlerts()).resolves.toHaveLength(3);
    await expect(listAlerts({ severity: 'critical' })).resolves.toHaveLength(2);
    await expect(listAlerts({ api_name: 'Payments API' })).resolves.toHaveLength(2);
    await expect(
      listAlerts({ api_name: 'Payments API', severity: 'warning' }),
    ).resolves.toHaveLength(1);
  });

  it('does not return resolved alerts', async () => {
    const { alert } = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });

    await resolveAlert(alert._id);

    await expect(listAlerts()).resolves.toHaveLength(0);
  });
});

describe('resolveAlert', () => {
  it('marks an alert resolved and is idempotent', async () => {
    const { alert } = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });

    const first = await resolveAlert(alert._id);
    expect(first.status).toBe('resolved');
    expect(first.resolvedAt).toBeInstanceOf(Date);

    const second = await resolveAlert(alert._id);
    expect(second.status).toBe('resolved');
    expect(second.resolvedAt.getTime()).toBe(first.resolvedAt.getTime());
  });

  it('returns null for an unknown id', async () => {
    const missing = new mongoose.Types.ObjectId();

    await expect(resolveAlert(missing)).resolves.toBeNull();
  });

  it('allows a new active alert after the previous one is resolved', async () => {
    const first = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });
    await resolveAlert(first.alert._id);

    const second = await recordAnomaly(item, failedRequest, {
      consecutiveFailures: 1,
    });

    expect(second.created).toBe(true);
    expect(aiAlert.generateMessage).toHaveBeenCalledTimes(2);
    await expect(
      Alert.countDocuments({ api_name: item.api_name, type: failedRequest.type }),
    ).resolves.toBe(2);
    await expect(Alert.countDocuments({ status: 'active' })).resolves.toBe(1);
  });
});
