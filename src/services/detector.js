const thresholds = require('../config/thresholds');

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStatusCode(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function collectIssues(item) {
  const issues = [];

  if (!isNonNegativeNumber(item.response_time_ms)) {
    issues.push('response_time_ms must be a non-negative number');
  }
  if (!isStatusCode(item.status_code)) {
    issues.push('status_code must be an integer between 100 and 599');
  }
  if (!isNonNegativeInteger(item.records_returned)) {
    issues.push('records_returned must be a non-negative integer');
  }

  return issues;
}

function detectAnomalies(item, context = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return [{
      type: 'INVALID_DATA',
      severity: 'warning',
      issues: ['check result must be an object'],
    }];
  }

  const anomalies = [];
  const issues = collectIssues(item);

  if (issues.length > 0) {
    anomalies.push({
      type: 'INVALID_DATA',
      severity: 'warning',
      issues,
    });
  }

  if (
    isNonNegativeNumber(item.response_time_ms)
    && item.response_time_ms > thresholds.HIGH_RESPONSE_TIME_MS
  ) {
    anomalies.push({
      type: 'HIGH_RESPONSE_TIME',
      severity: 'warning',
    });
  }

  if (isStatusCode(item.status_code) && item.status_code >= thresholds.FAILED_STATUS_MIN) {
    const consecutiveFailures = Number.isInteger(context.consecutiveFailures)
      ? context.consecutiveFailures
      : 0;
    const repeated = consecutiveFailures >= thresholds.REPEATED_FAILURE_COUNT;
    const critical = item.status_code >= thresholds.CRITICAL_STATUS_MIN || repeated;

    anomalies.push({
      type: 'FAILED_REQUEST',
      severity: critical ? 'critical' : 'warning',
    });

    if (repeated) {
      anomalies.push({
        type: 'REPEATED_FAILURE',
        severity: 'critical',
      });
    }
  }

  if (
    isStatusCode(item.status_code)
    && item.status_code < thresholds.FAILED_STATUS_MIN
    && isNonNegativeInteger(item.records_returned)
    && item.records_returned === 0
  ) {
    anomalies.push({
      type: 'NO_RECORDS',
      severity: 'warning',
    });
  }

  return anomalies;
}

module.exports = { detectAnomalies };
