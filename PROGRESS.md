# Progress

Last updated: 2026-10-24

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
- Fix: `db.js` rethrow attaches the original error as `cause` for better
  stack traces; `no-console` ESLint rule now allows `scripts/`
- Fix: hard-coded `dns.setServers` removed from `server.js` and
  `clean-sample-data.js`; replaced with `src/config/dns.js` helper driven by
  optional `DNS_SERVERS` env var (tested, documented in README + .env.example)
- Chore: `clean-sample-data.js` no longer deletes the non-existent
  `apiconfigs` collection; `npm run db:clean` script added and documented
- Docs: PowerShell sample commands added to README; `sample-assignment.json`
  created with the two assignment-brief items (PatientDataAPI 1200 ms /
  200 / 50 records, AppointmentAPI 5500 ms / 500 / 0 records)
- Fix: `src/config/dns.js` now loads dotenv itself (`quiet: true`) so
  `DNS_SERVERS` set in `.env` is honored even when `applyDnsOverride()` is
  called before `env.js` runs; regression test spawns a child process with a
  temp `.env` and asserts `dns.getServers()` reflects it; `sample-assignment.json`
  PatientDataAPI label corrected from "slow response" to "healthy"

- Fix: `updateExistingAlert` in `src/services/alertPolicy.js` now uses
  `$max` to keep the highest `consecutiveFailures` so concurrent updates
  for the same API cannot lower the stored value; regression test applies
  counts 3 then 1 and asserts the stored value stays 3
- Fix: `cleanMessage` in `src/services/aiAlert.js` now normalizes all
  Unicode space separators (`\p{Zs}`, including U+00A0, U+202F, U+2009 and
  U+3000) to one ASCII space and collapses repeated spaces, in addition to
  normalizing U+2011 (non-breaking hyphen) to `-` and removing zero-width
  characters (U+200B, U+200C, U+200D, U+FEFF); regression tests cover
  U+202F, U+2011, zero-width characters, and thin/ideographic spaces

## Next
- Re-test the Groq LLM after rotating credentials
- Record the 5–10 minute video and convert AI_Prompts.md to AI_Prompts.docx
