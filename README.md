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

## Status

The application is under construction. Features are tracked in
`feature_list.json` and progress is tracked in `PROGRESS.md`.
