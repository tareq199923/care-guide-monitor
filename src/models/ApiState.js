const mongoose = require('mongoose');

const apiStateSchema = new mongoose.Schema({
  api_name: { type: String, required: true, trim: true, unique: true },
  consecutiveFailures: { type: Number, default: 0, min: 0 },
  lastStatusCode: { type: Number, default: null },
  lastCheckedAt: { type: Date, default: null },
}, { timestamps: true });

const ApiState = mongoose.model('ApiState', apiStateSchema);

module.exports = { ApiState };
