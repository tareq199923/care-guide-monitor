const thresholds = require('../config/thresholds');

function buildFallbackMessage(item, anomaly, context = {}) {
  const apiName = item.api_name || 'Unknown API';

  switch (anomaly.type) {
    case 'HIGH_RESPONSE_TIME':
      return `${apiName} is responding slowly: ${item.response_time_ms} ms (threshold ${thresholds.HIGH_RESPONSE_TIME_MS} ms).`;

    case 'FAILED_REQUEST': {
      if (item.records_returned === 0) {
        return `${apiName} is returning HTTP ${item.status_code} and returned 0 records, so requests are failing.`;
      }
      return `${apiName} is returning HTTP ${item.status_code}, so requests are failing.`;
    }

    case 'NO_RECORDS':
      return `${apiName} returned 0 records, so downstream data may be missing.`;

    case 'INVALID_DATA': {
      const issues = Array.isArray(anomaly.issues) && anomaly.issues.length > 0
        ? anomaly.issues.join(', ')
        : 'unknown fields';
      return `${apiName} sent an invalid check result: ${issues}.`;
    }

    case 'REPEATED_FAILURE':
      return `${apiName} has failed ${context.consecutiveFailures ?? 'several'} consecutive checks (last HTTP ${item.status_code}).`;

    default:
      return `${apiName} produced a ${anomaly.type} anomaly.`;
  }
}

module.exports = { buildFallbackMessage };
