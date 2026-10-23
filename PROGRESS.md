# Progress

Last updated: 2026-10-23

## Done
- Project setup, MongoDB Atlas ready, CLAUDE.md written
- Planning complete: backend file list, alert model, LLM prompt design, 10-step build order
- Added feature_list.json with feature statuses
- Added settled decisions, definition of done and end-of-session checklist to CLAUDE.md
- Commit 1: npm scripts, ESLint, Jest, `npm run check`, and a passing
  mongodb-memory-server smoke test
- Commit 2: env config, thresholds, winston logger, Express app skeleton,
  request logging, central error handling and `GET /health`
- Commit 3: pure detector for all five anomaly types, including the
  status-aware NO_RECORDS rule and repeated-failure context
- Commit 4: Alert and ApiState schemas, defaults, enums, and the partial
  unique index for active alerts
- Commit 5: OpenAI-compatible alert writer with prompt building, one retry,
  message cleaning, and per-type template fallbacks
- Commit 6: alert policy with deduplication, occurrence tracking, severity
  escalation, filtering, and idempotent resolve
- Commit 7: POST /monitor with batch validation, atomic ApiState counters,
  allSettled processing, and LLM concurrency limited to five
- Commit 8: GET /alerts with filters and PATCH /alerts/:id/resolve with
  idempotent resolution and clear 400/404 responses
- Commit 9: static frontend dashboard with filters, resolve action, and
  30-second auto-refresh served by Express
- Commit 10: final documentation, sample data, prompt log, and CLAUDE.md
  reconciliation
- Review fix: capped `api_name` at 200 characters and fallback messages at
  500 characters, with regression tests
- Review fix: added static-frontend serving tests for `/` and `/app.js`
- Review fix: retried ApiState upserts on duplicate keys and made alert
  occurrence updates atomic
- Review fix: background dashboard refreshes no longer hide the current rows,
  and stale responses are ignored
- Review fix: README architecture table, design decisions, Node 20.19
  requirement, corrected detection docs, and a directly usable sample batch
- Review chore: removed the unused `cors` dependency and added an error
  handler to the in-memory development script
- Fix: reasoning-model LLM requests now use a 1024-token completion budget,
  optional `reasoning_effort`, and temperature 0.6

## Next
- Re-test the Groq LLM after rotating credentials
- Record the 5–10 minute video and convert AI_Prompts.md to AI_Prompts.docx
