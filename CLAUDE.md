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
- src/services     business logic (detector, aiAlert, alertPolicy, email)
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
- NO_RECORDS: records_returned is 0 or missing
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

## Session protocol
- Start of session: read PROGRESS.md
- End of session: update PROGRESS.md (Done, Next), run tests, commit

## Deliverables (do not forget)
- GitHub repo with full source code
- README with setup and run instructions
- Video explanation, 5 to 10 minutes: architecture, workflow, key decisions
- AI_Prompts.docx (convert from AI_Prompts.md) if AI was used
- Submit by replying to all on the original email, with portfolio, CV,
  repo link and Drive link