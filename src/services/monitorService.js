const thresholds = require('../config/thresholds');
const logger = require('../utils/logger');
const { ApiState } = require('../models/ApiState');
const { detectAnomalies } = require('./detector');
const { recordAnomaly } = require('./alertPolicy');

function isValidStatus(code) {
  return Number.isInteger(code) && code >= 100 && code <= 599;
}

async function updateApiState(item) {
  const statusValid = isValidStatus(item.status_code);
  const isFailure = statusValid && item.status_code >= thresholds.FAILED_STATUS_MIN;
  const isSuccess = statusValid && item.status_code < thresholds.FAILED_STATUS_MIN;

  const update = {
    $set: {
      lastCheckedAt: new Date(),
    },
  };

  if (statusValid) {
    update.$set.lastStatusCode = item.status_code;
  }
  if (isFailure) {
    update.$inc = { consecutiveFailures: 1 };
  }
  if (isSuccess) {
    update.$set.consecutiveFailures = 0;
  }

  return ApiState.findOneAndUpdate(
    { api_name: item.api_name },
    update,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function processItem(item, index) {
  const state = await updateApiState(item);
  const context = { consecutiveFailures: state.consecutiveFailures };
  const anomalies = detectAnomalies(item, context);
  const result = { created: 0, updated: 0, errors: [] };

  for (const anomaly of anomalies) {
    try {
      const recorded = await recordAnomaly(item, anomaly, context);
      if (recorded.created) {
        result.created += 1;
      } else {
        result.updated += 1;
      }
    } catch (error) {
      logger.error('Failed to record anomaly', {
        index,
        api_name: item.api_name,
        type: anomaly.type,
        message: error.message,
      });
      result.errors.push({
        index,
        api_name: item.api_name,
        type: anomaly.type,
        message: 'Failed to save alert',
      });
    }
  }

  return result;
}

async function processBatch(items) {
  const summary = {
    received: items.length,
    processed: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  const concurrency = Math.max(1, thresholds.LLM_CONCURRENCY);

  for (let start = 0; start < items.length; start += concurrency) {
    const chunk = items.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      chunk.map((item, offset) => processItem(item, start + offset)),
    );

    results.forEach((result, offset) => {
      const index = start + offset;

      if (result.status === 'fulfilled') {
        summary.processed += 1;
        summary.created += result.value.created;
        summary.updated += result.value.updated;
        summary.errors.push(...result.value.errors);
        return;
      }

      logger.error('Failed to process check result', {
        index,
        api_name: items[index].api_name,
        message: result.reason.message,
      });
      summary.errors.push({
        index,
        api_name: items[index].api_name,
        message: 'Failed to process check result',
      });
    });
  }

  logger.info('Monitor batch processed', {
    received: summary.received,
    processed: summary.processed,
    created: summary.created,
    updated: summary.updated,
    errors: summary.errors.length,
  });

  return summary;
}

module.exports = { processBatch };
