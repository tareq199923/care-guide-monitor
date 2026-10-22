const mongoose = require('mongoose');
const thresholds = require('../config/thresholds');

const ANOMALY_TYPES = [
  'HIGH_RESPONSE_TIME',
  'FAILED_REQUEST',
  'NO_RECORDS',
  'INVALID_DATA',
  'REPEATED_FAILURE',
];

const SEVERITIES = ['warning', 'critical'];
const STATUSES = ['active', 'resolved'];

const sourceDataSchema = new mongoose.Schema({
  response_time_ms: { type: Number, default: null },
  status_code: { type: Number, default: null },
  records_returned: { type: Number, default: null },
  issues: { type: [String], default: [] },
}, { _id: false });

const alertSchema = new mongoose.Schema({
  api_name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ANOMALY_TYPES },
  severity: { type: String, required: true, enum: SEVERITIES },
  status: { type: String, enum: STATUSES, default: 'active' },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: thresholds.MESSAGE_MAX_LENGTH,
  },
  aiGenerated: { type: Boolean, default: false },
  consecutiveFailures: { type: Number, default: 0, min: 0 },
  occurrences: { type: Number, default: 1, min: 1 },
  sourceData: { type: sourceDataSchema, default: () => ({}) },
  lastSeenAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

alertSchema.index(
  { api_name: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

alertSchema.index({ status: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = {
  Alert,
  ANOMALY_TYPES,
  SEVERITIES,
  STATUSES,
};
