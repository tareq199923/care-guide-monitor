# Care Guide Monitor

Intelligent API monitoring and alert system. It receives batches of API check
results, detects anomalies, writes a human-readable alert, and stores it in
MongoDB.

## Development

Requirements: Node.js 18+, npm, and a MongoDB connection (Atlas or local).

```bash
npm install
cp .env.example .env
npm run dev
```

### Scripts

- `npm start` starts the server.
- `npm run dev` starts the server with nodemon.
- `npm run lint` runs ESLint.
- `npm test` runs Jest.
- `npm run check` runs lint and then the test suite. This must pass before a
  commit.

Tests use `mongodb-memory-server`, so they do not touch the development
database.

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | required | MongoDB connection string |
| `LLM_BASE_URL` | empty | OpenAI-compatible API base URL |
| `LLM_API_KEY` | empty | API key for the LLM provider |
| `LLM_MODEL` | empty | Model name |
| `LLM_TIMEOUT_MS` | `10000` | LLM request timeout |
| `LOG_LEVEL` | `info` | Winston log level |

LLM settings are optional. When they are missing, alerts use the template
fallback.

## Health check

```http
GET /health
```

```json
{ "status": "ok", "uptime": 42 }
```

## POST /monitor

Accepts a JSON array of check results:

```http
POST /monitor
Content-Type: application/json

[
  {
    "api_name": "Payments API",
    "response_time_ms": 4200,
    "status_code": 200,
    "records_returned": 50
  }
]
```

It returns the batch summary:

```json
{
  "received": 1,
  "processed": 1,
  "created": 1,
  "updated": 0,
  "errors": []
}
```

`created` and `updated` count alerts, not check results. Processing runs
synchronously in chunks of `LLM_CONCURRENCY` (5), and one failed item does
not stop the rest of the batch.

A `400` is returned when the body is not a non-empty array or an item has no
usable `api_name`. Every bad item is listed in `details`:

```json
{
  "error": "Validation failed",
  "details": [{ "index": 1, "message": "api_name must be a non-empty string" }]
}
```

Wrong or missing metric fields are accepted by validation and produce an
`INVALID_DATA` alert instead.

## Data model

`Alert` stores `api_name`, `type`, `severity`, `status`, `message`,
`aiGenerated`, `consecutiveFailures`, `occurrences`, a `sourceData`
snapshot, `lastSeenAt`, `resolvedAt`, and timestamps. A partial unique
index enforces one active alert per API and anomaly type.

`ApiState` stores one document per API with its consecutive failure count
and last observed status. It survives restarts and is updated atomically.

## Detection rules

Thresholds live in `src/config/thresholds.js`.

| Type | Condition | Severity |
| --- | --- | --- |
| `HIGH_RESPONSE_TIME` | `response_time_ms` above 3000 | warning |
| `FAILED_REQUEST` | `status_code` 400 or above | warning for 4xx, critical for 5xx |
| `NO_RECORDS` | successful request (`status_code` below 400) with `records_returned` equal to 0 | warning |
| `INVALID_DATA` | wrong types or missing required fields | warning |
| `REPEATED_FAILURE` | 3 or more consecutive failed checks for an API | critical |

A failed request with zero records produces only `FAILED_REQUEST`. A missing
`records_returned` value produces `INVALID_DATA`, not `NO_RECORDS`.

## Alert lifecycle

- A new anomaly creates an active alert with an AI or fallback message.
- Another occurrence of the same `api_name` and `type` while the alert is
  active updates its snapshot, `occurrences`, `lastSeenAt`, and severity
  instead of creating a duplicate. Severity only escalates, never downgrades.
- The LLM is not called again for updates.
- Resolving an alert sets `status` to `resolved` and `resolvedAt`. Resolving
  an already-resolved alert changes nothing.
- A later occurrence after resolution creates a new active alert.

## AI alert messages

New alerts are written by an OpenAI-compatible chat completion. Configure
`LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` to enable it. The prompt
includes the API name, anomaly type, severity, and the relevant check values
(including `records_returned` for failed requests).

The LLM is called only when a new alert is created. Each call is retried
once, then `src/utils/fallbackMessages.js` produces a deterministic message
with `aiGenerated` set to false. If the LLM settings are missing, the
fallback is used directly. The exact prompts are recorded in
`AI_Prompts.md`.

## Status

The application is under construction. Features are tracked in
`feature_list.json` and progress is tracked in `PROGRESS.md`.
