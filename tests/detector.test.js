const { detectAnomalies } = require('../src/services/detector');

function healthy(overrides = {}) {
  return {
    api_name: 'Payments API',
    response_time_ms: 120,
    status_code: 200,
    records_returned: 50,
    ...overrides,
  };
}

describe('detectAnomalies', () => {
  it('returns no anomalies for a healthy item', () => {
    expect(detectAnomalies(healthy())).toEqual([]);
  });

  it('flags a response time above the threshold', () => {
    expect(detectAnomalies(healthy({ response_time_ms: 3001 }))).toEqual([
      { type: 'HIGH_RESPONSE_TIME', severity: 'warning' },
    ]);
  });

  it('does not flag a response time at the threshold', () => {
    expect(detectAnomalies(healthy({ response_time_ms: 3000 }))).toEqual([]);
  });

  it('flags a 4xx request as a warning', () => {
    expect(detectAnomalies(healthy({ status_code: 404 }))).toEqual([
      { type: 'FAILED_REQUEST', severity: 'warning' },
    ]);
  });

  it('flags a 5xx request as critical', () => {
    expect(detectAnomalies(healthy({ status_code: 500 }))).toEqual([
      { type: 'FAILED_REQUEST', severity: 'critical' },
    ]);
  });

  it('flags zero records only when the request succeeded', () => {
    expect(detectAnomalies(healthy({ records_returned: 0 }))).toEqual([
      { type: 'NO_RECORDS', severity: 'warning' },
    ]);
  });

  it('does not flag zero records when the request failed', () => {
    expect(detectAnomalies(healthy({ status_code: 500, records_returned: 0 }))).toEqual([
      { type: 'FAILED_REQUEST', severity: 'critical' },
    ]);
  });

  it('treats a missing records count as invalid data, not no records', () => {
    const item = healthy();
    delete item.records_returned;

    expect(detectAnomalies(item)).toEqual([
      {
        type: 'INVALID_DATA',
        severity: 'warning',
        issues: ['records_returned must be a non-negative integer'],
      },
    ]);
  });

  it('collects all invalid field issues into one anomaly', () => {
    const anomalies = detectAnomalies({
      api_name: 'Payments API',
      response_time_ms: 'fast',
      status_code: null,
      records_returned: -1,
    });

    expect(anomalies).toEqual([
      {
        type: 'INVALID_DATA',
        severity: 'warning',
        issues: [
          'response_time_ms must be a non-negative number',
          'status_code must be an integer between 100 and 599',
          'records_returned must be a non-negative integer',
        ],
      },
    ]);
  });

  it('returns multiple anomalies for one item', () => {
    expect(detectAnomalies(healthy({
      response_time_ms: 4200,
      records_returned: 0,
    }))).toEqual([
      { type: 'HIGH_RESPONSE_TIME', severity: 'warning' },
      { type: 'NO_RECORDS', severity: 'warning' },
    ]);
  });

  it('escalates a repeated failure and adds REPEATED_FAILURE', () => {
    expect(detectAnomalies(
      healthy({ status_code: 503 }),
      { consecutiveFailures: 3 },
    )).toEqual([
      { type: 'FAILED_REQUEST', severity: 'critical' },
      { type: 'REPEATED_FAILURE', severity: 'critical' },
    ]);
  });

  it('escalates repeated 4xx failures to critical', () => {
    expect(detectAnomalies(
      healthy({ status_code: 404 }),
      { consecutiveFailures: 3 },
    )).toEqual([
      { type: 'FAILED_REQUEST', severity: 'critical' },
      { type: 'REPEATED_FAILURE', severity: 'critical' },
    ]);
  });

  it('does not flag repeated failure below the count', () => {
    expect(detectAnomalies(
      healthy({ status_code: 404 }),
      { consecutiveFailures: 2 },
    )).toEqual([
      { type: 'FAILED_REQUEST', severity: 'warning' },
    ]);
  });

  it('ignores a stale failure count for a healthy item', () => {
    expect(detectAnomalies(
      healthy(),
      { consecutiveFailures: 5 },
    )).toEqual([]);
  });

  it('handles a non-object item', () => {
    expect(detectAnomalies(null)).toEqual([
      {
        type: 'INVALID_DATA',
        severity: 'warning',
        issues: ['check result must be an object'],
      },
    ]);
  });
});
