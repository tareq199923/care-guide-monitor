require('dotenv').config({ quiet: true });

function readPositiveNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}

const env = {
  PORT: readPositiveNumber('PORT', 3000),
  MONGODB_URI: process.env.MONGODB_URI || '',
  LLM_BASE_URL: process.env.LLM_BASE_URL || '',
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  LLM_MODEL: process.env.LLM_MODEL || '',
  LLM_TIMEOUT_MS: readPositiveNumber('LLM_TIMEOUT_MS', 10000),
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info'),
};

env.isLlmConfigured = Boolean(
  env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL,
);

module.exports = Object.freeze(env);
