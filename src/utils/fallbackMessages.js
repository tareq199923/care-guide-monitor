const thresholds = require('../config/thresholds');

function truncateMessage(rawMessage) {
  const message = String(rawMessage).trim();

  if (message.length <= thresholds.MESSAGE_MAX_LENGTH) {
    return message;
  }

  return `${message.slice(0, thresholds.MESSAGE_MAX_LENGTH - 3).trimEnd()}...`;
}

function buildFallbackMessage(item, anomaly, context = {}) {
  const apiName = item.api_name || 'Unknown API';
  let message;

  switch (anomaly.type) {
    case 'HIGH_RESPONSE_TIME':
      message = `${apiName} is responding slowly: ${item.response_time_ms} ms (threshold ${thresholds.HIGH_RESPONSE_TIME_MS} ms).`;
      break;

    case 'FAILED_REQUEST':
      message = item.records_returned === 0
        ? `${apiName} is returning HTTP ${item.status_code} and returned 0 records, so requests are failing.`
        : `${apiName} is returning HTTP ${item.status_code}, so requests are failing.`;
      break;

    case 'NO_RECORDS':
      message = `${apiName} returned 0 records, so downstream data may be missing.`;
      break;

    case 'INVALID_DATA': {
      const issues = Array.isArray(anomaly.issues) && anomaly.issues.length > 0
        ? anomaly.issues.join(', ')
        : 'unknown fields';
      message = `${apiName} sent an invalid check result: ${issues}.`;
      break;
    }

    case 'REPEATED_FAILURE':
      message = `${apiName} has failed ${context.consecutiveFailures ?? 'several'} consecutive checks (last HTTP ${item.status_code}).`;
      break;

    default:
      message = `${apiName} produced a ${anomaly.type} anomaly.`;
  }

  return truncateMessage(message);
}

module.exports = { buildFallbackMessage, truncateMessage };
