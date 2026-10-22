# CLAUDE.md: Intelligent API Monitoring & Alert System

A Node.js backend that monitors API
check results, detects anomalies, and generates AI-written, human-readable
alerts. Read this file and PROGRESS.md at the start of every session.

## Goal
- Receive batches of API check results (POST /monitor)
- Detect anomalies with clear rules
- Generate an alert message with an LLM
- Store anomalies in MongoDB
- Expose active anomalies (GET /alerts) and show them in a clean frontend

## Stack
- Node.js 18+ (CommonJS), Express
- MongoDB with Mongoose
- LLM through the `openai` package against any OpenAI-compatible provider.
  Configured only by env vars: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
- winston for logging
- jest + supertest for tests
- Frontend: plain HTML/CSS/JS in /frontend, served by Express

## Commands
- npm run dev      start with nodemon
- npm start        start normally
- npm test         run tests

## Folder structure
- src/config       env loading and thresholds
- src/routes       route definitions only
- src/controllers  thin request/response handlers
- src/services     business logic (detector, aiAlert, alertPolicy)
- src/models       Mongoose schemas
- src/middleware   validation, error handler, request logging
- src/utils        logger and helpers
- frontend         dashboard UI
- tests            jest tests
- logs             log files (gitignored)

## Endpoints
- POST  /monitor              body: JSON array of API check results
- GET   /alerts               active anomalies (supports ?severity= and ?api_name=)
- PATCH /alerts/:id/resolve   mark an alert as resolved
- GET   /health               simple health check

## Input item
{ "api_name": "string", "response_time_ms": number,
  "status_code": number, "records_returned": number }

## Detection rules
Thresholds live in src/config/thresholds.js. Never hardcode them.
- HIGH_RESPONSE_TIME: response_time_ms above 3000
- FAILED_REQUEST: status_code 400 or above
- NO_RECORDS: records_returned is 0 with a valid status_code below 400
- INVALID_DATA: wrong types or missing required fields
- REPEATED_FAILURE: consecutive failures per api_name (3 or more = critical)

Severity: critical (5xx, or repeated failure), warning (slow, 4xx, no records).

## Alert model
api_name, type, severity, status (active or resolved), message,
aiGenerated (boolean), consecutiveFailures, source data snapshot,
createdAt, resolvedAt.

## Rules for the code
- The detector is a pure function: no database, no AI, no req/res.
  It takes one check result and returns a list of anomalies
- If the LLM fails or times out, retry once, then save a template alert
  and set aiGenerated to false. Never lose an anomaly because AI failed
- Validate all input. Return clear 400 errors with a message per bad item
- Process batches with Promise.allSettled so one failure does not stop the rest
- Do not create a duplicate alert for the same api_name and same anomaly
  type while one is still active. Update it instead
- Log with winston (console and logs/ file). Never use plain console.log
- Central error-handling middleware. No uncaught promise rejections
- Never commit .env or any secret. Keep .env.example up to date

## Decisions
- Invalid batch items: return 400 only when the body is not a non-empty
  array or an item has no usable api_name. Items with bad or missing
  numeric fields still produce INVALID_DATA alerts, and the response
  includes an errors summary.
- Consecutive failures live in the ApiState collection, one document per
  api_name, updated atomically.
- The LLM is called only when a new alert is created. Updates to an active
  alert never call the LLM. One retry, then a template fallback with
  aiGenerated set to false.
- Test database: mongodb-memory-server. If it cannot download or run on a
  machine, use MONGODB_URI_TEST against a separate test database and never
  the development database.
- POST /monitor processes synchronously and returns 200 with
  { received, processed, created, updated, errors }.
- Email notifications are out of scope.
- NO_RECORDS fires only when status_code is a valid number below 400 and
  records_returned is 0. A failed request produces FAILED_REQUEST only.
- LLM prompts always include records_returned when it is a valid number,
  so a failed check can mention that zero records were returned.
- At most LLM_CONCURRENCY (5) LLM calls run in parallel during a batch.
  The value lives in src/config/thresholds.js.
- The frontend ships before the final documentation pass.
- GET /alerts returns active alerts only, newest first, with severity and
  api_name filters. No pagination.
- PATCH /alerts/:id/resolve is idempotent. Malformed ids return 400 and
  unknown ids return 404.
- Express 5 handles async route errors, so no asyncHandler wrapper is
  needed. CORS is not needed because Express serves the frontend.
- If LLM configuration is missing, skip the call and use the template
  fallback.

## Conventions
- Documentation follows implementation: never document a feature before
  its code and tests exist
- One place for detection rules (services/detector.js) and one place for
  the LLM call (services/aiAlert.js). No duplicates
- Layering: routes -> controllers (thin) -> services (logic) -> models
  (database only). Services never use req or res
- Secrets are never logged. Do not log LLM_API_KEY or the Mongo password
- Tests never call the real LLM. Mock the LLM client. Test the fallback by
  making the mock fail on purpose
- Every feature ships with a test and updates the README in the same commit

## Testing
- Unit tests for the detector first (slow, 5xx, 4xx, zero records,
  missing fields, healthy item, multiple anomalies on one item)
- Tests for the AI service: success path and fallback path
- API tests with supertest for POST /monitor and GET /alerts

## Workflow
- Small steps, one commit per step, clear commit messages
  (feat:, fix:, test:, docs:, chore:)
- Use plan mode before writing code for a new feature
- Keep sample-data.json with healthy and unhealthy examples
- README must include: overview, architecture table, setup, env vars,
  run instructions, API examples, design decisions
- Every prompt given to the AI is logged in AI_Prompts.md

## Definition of done
A feature is done only when all of these are true:
- `npm run check` passes (`eslint .` then `jest`).
- New behavior has tests, and the LLM is mocked in tests.
- README is updated with the feature's usage or behavior.
- AI_Prompts.md includes any prompt added or changed.
- PROGRESS.md is updated (Done and Next).
- No secret or API key is logged or committed.

## End of session checklist
1. Run `npm run check`.
2. Update PROGRESS.md (Done, Next).
3. Update feature_list.json statuses.
4. Update AI_Prompts.md if prompts changed.
5. Commit the changes with a clear message.

## Session protocol
- Start of session: read PROGRESS.md and feature_list.json, then CLAUDE.md.
- Before starting a new feature: mark it active in feature_list.json.
- After a feature is verified: mark it done in feature_list.json in the
  same commit.
- End of session: run `npm run check`, update PROGRESS.md (Done, Next),
  and commit.

## Deliverables (do not forget)
- GitHub repo with full source code
- README with setup and run instructions
- Video explanation, 5 to 10 minutes: architecture, workflow, key decisions
- AI_Prompts.docx (convert from AI_Prompts.md) if AI was used
- Submit by replying to all on the original email, with portfolio, CV,
  repo link and Drive link