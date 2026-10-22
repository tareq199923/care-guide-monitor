const { Alert, ANOMALY_TYPES } = require('../src/models/Alert');
const { ApiState } = require('../src/models/ApiState');

function validAlert(overrides = {}) {
  return new Alert({
    api_name: 'Payments API',
    type: 'FAILED_REQUEST',
    severity: 'critical',
    message: 'Payments API is returning HTTP 500.',
    ...overrides,
  });
}

async function getValidationError(document) {
  try {
    await document.validate();
    return null;
  } catch (error) {
    return error;
  }
}

describe('Alert model', () => {
  it('accepts a valid alert and applies defaults', async () => {
    const alert = validAlert();

    await expect(alert.validate()).resolves.toBeUndefined();
    expect(alert.status).toBe('active');
    expect(alert.aiGenerated).toBe(false);
    expect(alert.consecutiveFailures).toBe(0);
    expect(alert.occurrences).toBe(1);
    expect(alert.lastSeenAt).toBeInstanceOf(Date);
    expect(alert.resolvedAt).toBeNull();
    expect(alert.sourceData.issues).toEqual([]);
  });

  it('requires the core fields', async () => {
    const error = await getValidationError(new Alert({}));

    expect(error.errors.api_name).toBeDefined();
    expect(error.errors.type).toBeDefined();
    expect(error.errors.severity).toBeDefined();
    expect(error.errors.message).toBeDefined();
  });

  it('rejects unknown anomaly types and severities', async () => {
    const error = await getValidationError(validAlert({
      type: 'SOMETHING_ELSE',
      severity: 'urgent',
    }));

    expect(error.errors.type).toBeDefined();
    expect(error.errors.severity).toBeDefined();
  });

  it('rejects a message longer than the limit', async () => {
    const error = await getValidationError(validAlert({
      message: 'x'.repeat(501),
    }));

    expect(error.errors.message).toBeDefined();
  });

  it('supports every anomaly type', async () => {
    for (const type of ANOMALY_TYPES) {
      await expect(validAlert({ type }).validate()).resolves.toBeUndefined();
    }
  });

  it('has one active alert per api_name and type', () => {
    const index = Alert.schema.indexes().find(
      ([keys]) => keys.api_name === 1 && keys.type === 1,
    );

    expect(index).toBeDefined();
    expect(index[1].unique).toBe(true);
    expect(index[1].partialFilterExpression).toEqual({ status: 'active' });
  });
});

describe('ApiState model', () => {
  it('applies defaults and requires an api_name', async () => {
    const state = new ApiState({ api_name: 'Payments API' });

    await expect(state.validate()).resolves.toBeUndefined();
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastStatusCode).toBeNull();
    expect(state.lastCheckedAt).toBeNull();
  });

  it('requires an api_name', async () => {
    const error = await getValidationError(new ApiState({}));

    expect(error.errors.api_name).toBeDefined();
  });
});
