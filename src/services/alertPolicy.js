const { Alert } = require('../models/Alert');
const aiAlert = require('./aiAlert');

function buildSourceData(item, anomaly) {
  return {
    response_time_ms: Number.isFinite(item.response_time_ms)
      ? item.response_time_ms
      : null,
    status_code: Number.isInteger(item.status_code)
      ? item.status_code
      : null,
    records_returned: Number.isInteger(item.records_returned)
      ? item.records_returned
      : null,
    issues: Array.isArray(anomaly.issues) ? anomaly.issues : [],
  };
}

function normalizeFailureCount(context) {
  return Number.isInteger(context.consecutiveFailures)
    ? context.consecutiveFailures
    : 0;
}

async function updateExistingAlert(existing, item, anomaly, context) {
  const severity = existing.severity === 'critical' || anomaly.severity === 'critical'
    ? 'critical'
    : 'warning';

  existing.severity = severity;
  existing.consecutiveFailures = normalizeFailureCount(context);
  existing.sourceData = buildSourceData(item, anomaly);
  existing.lastSeenAt = new Date();
  existing.occurrences = (existing.occurrences || 1) + 1;

  await existing.save();
  return existing;
}

async function recordAnomaly(item, anomaly, context = {}) {
  const activeAlert = await Alert.findOne({
    api_name: item.api_name,
    type: anomaly.type,
    status: 'active',
  });

  if (activeAlert) {
    const alert = await updateExistingAlert(activeAlert, item, anomaly, context);
    return { alert, created: false };
  }

  const { message, aiGenerated } = await aiAlert.generateMessage(
    item,
    anomaly,
    context,
  );

  try {
    const alert = await Alert.create({
      api_name: item.api_name,
      type: anomaly.type,
      severity: anomaly.severity,
      status: 'active',
      message,
      aiGenerated,
      consecutiveFailures: normalizeFailureCount(context),
      occurrences: 1,
      sourceData: buildSourceData(item, anomaly),
      lastSeenAt: new Date(),
    });

    return { alert, created: true };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const existing = await Alert.findOne({
      api_name: item.api_name,
      type: anomaly.type,
      status: 'active',
    });

    if (!existing) {
      throw error;
    }

    const alert = await updateExistingAlert(existing, item, anomaly, context);
    return { alert, created: false };
  }
}

async function listAlerts(filters = {}) {
  const query = { status: 'active' };

  if (filters.severity) {
    query.severity = filters.severity;
  }
  if (filters.api_name) {
    query.api_name = filters.api_name;
  }

  return Alert.find(query).sort({ createdAt: -1 }).lean();
}

async function resolveAlert(id) {
  const alert = await Alert.findById(id);

  if (!alert) {
    return null;
  }

  if (alert.status !== 'resolved') {
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();
  }

  return alert;
}

module.exports = {
  recordAnomaly,
  listAlerts,
  resolveAlert,
};
