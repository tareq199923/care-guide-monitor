const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const alertPolicy = require('../services/alertPolicy');
const { SEVERITIES } = require('../models/Alert');

async function list(req, res) {
  const { severity, api_name: apiName } = req.query;

  if (severity !== undefined && !SEVERITIES.includes(severity)) {
    throw new AppError('severity must be warning or critical', 400);
  }
  if (
    apiName !== undefined
    && (typeof apiName !== 'string' || apiName.trim() === '')
  ) {
    throw new AppError('api_name must be a non-empty string', 400);
  }

  const filters = {};
  if (severity) {
    filters.severity = severity;
  }
  if (apiName) {
    filters.api_name = apiName.trim();
  }

  const alerts = await alertPolicy.listAlerts(filters);

  res.json({
    count: alerts.length,
    alerts,
  });
}

async function resolve(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid alert id', 400);
  }

  const alert = await alertPolicy.resolveAlert(req.params.id);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  res.json({ alert });
}

module.exports = { list, resolve };
