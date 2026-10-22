const OpenAI = require('openai');
const env = require('../config/env');
const thresholds = require('../config/thresholds');
const logger = require('../utils/logger');
const { buildFallbackMessage } = require('../utils/fallbackMessages');

const SYSTEM_PROMPT = `You are an on-call monitoring assistant. Write one short alert message for an engineer about an API health check.

Rules:
- 1 to 2 sentences, under 45 words.
- Plain text only: no markdown, no emojis, no greeting, no signature.
- State what is wrong, include the key value or status code, and the likely user impact.
- If the request failed and records_returned is 0, mention that no records were returned.
- Use only the supplied data. Do not invent causes, fixes, history, or severity words.
- Return only the alert message.`;

let client;

function getClient() {
  if (!env.isLlmConfigured) {
    return null;
  }

  if (!client) {
    client = new OpenAI({
      apiKey: env.LLM_API_KEY,
      baseURL: env.LLM_BASE_URL,
      timeout: env.LLM_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  return client;
}

function buildPromptData(item, anomaly, context = {}) {
  const data = {
    api_name: item.api_name,
    anomaly_type: anomaly.type,
    severity: anomaly.severity,
  };

  if (Number.isFinite(item.response_time_ms)) {
    data.response_time_ms = item.response_time_ms;
  }
  if (Number.isInteger(item.status_code)) {
    data.status_code = item.status_code;
  }
  if (Number.isInteger(item.records_returned)) {
    data.records_returned = item.records_returned;
  }
  if (anomaly.type === 'HIGH_RESPONSE_TIME') {
    data.threshold_ms = thresholds.HIGH_RESPONSE_TIME_MS;
  }
  if (anomaly.type === 'INVALID_DATA' && Array.isArray(anomaly.issues)) {
    data.issues = anomaly.issues;
  }
  if (Number.isInteger(context.consecutiveFailures) && context.consecutiveFailures > 0) {
    data.consecutive_failures = context.consecutiveFailures;
  }

  return data;
}

function buildPrompt(item, anomaly, context = {}) {
  const data = buildPromptData(item, anomaly, context);
  return `Alert data:\n${JSON.stringify(data, null, 2)}\n\nWrite the alert message.`;
}

function cleanMessage(rawMessage) {
  if (typeof rawMessage !== 'string') {
    return '';
  }

  const message = rawMessage
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (message.length <= thresholds.MESSAGE_MAX_LENGTH) {
    return message;
  }

  return `${message.slice(0, thresholds.MESSAGE_MAX_LENGTH - 3).trimEnd()}...`;
}

async function generateMessage(item, anomaly, context = {}) {
  const fallback = buildFallbackMessage(item, anomaly, context);
  const llm = getClient();

  if (!llm) {
    logger.warn('LLM is not configured; using template fallback', {
      api_name: item.api_name,
      type: anomaly.type,
    });
    return { message: fallback, aiGenerated: false };
  }

  const prompt = buildPrompt(item, anomaly, context);

  for (let attempt = 1; attempt <= thresholds.LLM_MAX_ATTEMPTS; attempt += 1) {
    try {
      const completion = await llm.chat.completions.create({
        model: env.LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 120,
      });

      const message = cleanMessage(completion.choices?.[0]?.message?.content);
      if (message) {
        return { message, aiGenerated: true };
      }

      throw new Error('LLM returned an empty message');
    } catch (error) {
      logger.warn('LLM alert generation failed', {
        api_name: item.api_name,
        type: anomaly.type,
        attempt,
        maxAttempts: thresholds.LLM_MAX_ATTEMPTS,
        error: error.message,
      });
    }
  }

  return { message: fallback, aiGenerated: false };
}

module.exports = {
  SYSTEM_PROMPT,
  buildPrompt,
  buildPromptData,
  generateMessage,
};
