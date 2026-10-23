# AI Prompts Used

Tools: Claude Code (VS Code CLI) for planning and code generation,
Claude chat (claude.ai) for planning help and plan review, and OpenCode
for the follow-up review and fixes.
Prompts are listed in the order I used them.

---

## Part 1: Claude Code prompts

### Prompt 1: Plan mode
Date: 23 Oct 2026
Result: file list, 10-commit build order, alert model, LLM prompt design, 6 open decisions

```
Read CLAUDE.md and PROGRESS.md. We are in plan mode, so do not write code yet.

Propose:
1. The exact file list for the backend (src/config, routes, controllers, services, models, middleware, utils) with one line on what each file does
2. The build order in small steps, each ending in a commit
3. The Mongoose alert model fields
4. The LLM prompt design for generating alerts, and the template fallback message
5. Any decisions I need to make

Keep it simple and avoid over-engineering.
```

### Prompt 2: Approve plan with changes
Date: 23 Oct 2026
Result: revised plan (NO_RECORDS only below 400, LLM concurrency 5, frontend before docs)

```
Approved with these choices:
1. Invalid items: use your recommendation.
2. Consecutive failures: ApiState collection.
3. LLM only when creating a new alert.
4. mongodb-memory-server, but verify in commit 1 that it downloads and runs on my machine. If it fails, tell me and use a separate test database instead.
5. Synchronous POST /monitor returning 200 with the summary.
6. Skip email for now.

Three changes to the plan:
A. NO_RECORDS should fire only when status_code < 400, so a failed request produces one FAILED_REQUEST alert. Make sure the LLM prompt includes records_returned so the message can mention it (for example "failed with status 500 and returned 0 records").
B. Limit parallel LLM calls in a batch to a small concurrency (5), configurable in thresholds.js.
C. Swap the order: build the frontend before the final docs/README commit.

Also update PROGRESS.md after each commit. Exit plan mode and start with commit 1.
```

### Prompt 3: Start build
Date: 23 Oct 2026
Result: docs pre-commit (feature list, decisions, definition of done), then commit 1

```
go. Before commit 1, do a small commit "docs: add feature list, decisions and definition of done":
1. Create feature_list.json with the 10 commits from your revised order (feature 1 active, rest planned).
2. Add to CLAUDE.md: a "Decisions" section with all settled decisions from this planning session (including changes A, B, C), a "Definition of done" section (a feature is done only when npm run check passes), and an "End of session checklist".
3. Update the CLAUDE.md session protocol: at the start, read PROGRESS.md and feature_list.json.
Then continue with commit 1, and include in it: ESLint with a minimal config, and a "check" script in package.json that runs eslint then jest.
```

### Prompt 4: Begin building
Date: 23 Oct 2026
Result: implementation started after switching out of plan mode

```
lets think step by step and start building.
```

---

## Part 2: Planning help from Claude chat (claude.ai)

I used Claude chat to explain the assignment, review the Claude Code plan,
and help me choose between options. Summary:
- Explained the task requirements and the grading criteria
- Suggested reusing failover and health-tracking ideas from my own project (Invincible)
- Reviewed the plan and suggested 3 changes (A, B, C above)
- Helped write CLAUDE.md and the decisions list
I wrote and own the final decisions.

---

## Part 3: LLM prompts inside the app

Source: `src/services/aiAlert.js`. Settings: temperature `0.6`,
`max_completion_tokens` `LLM_MAX_COMPLETION_TOKENS` (default `1024`),
optional `reasoning_effort` from `LLM_REASONING_EFFORT`, timeout
`LLM_TIMEOUT_MS`, and one retry.

### System prompt

```text
You are an on-call monitoring assistant. Write one short alert message for an engineer about an API health check.

Rules:
- 1 to 2 sentences, under 45 words.
- Plain text only: no markdown, no emojis, no greeting, no signature.
- State what is wrong, include the key value or status code, and the likely user impact.
- If the request failed and records_returned is 0, mention that no records were returned.
- Use only the supplied data. Do not invent causes, fixes, history, or severity words.
- Return only the alert message.
```

### User prompt template

```text
Alert data:
{ ...JSON... }

Write the alert message.
```

The JSON always contains `api_name`, `anomaly_type`, and `severity`. It adds
only the relevant fields: `response_time_ms`, `status_code`,
`records_returned`, `threshold_ms`, `issues`, and `consecutive_failures`.

If the LLM fails twice or is not configured, `src/utils/fallbackMessages.js`
writes a deterministic message and `aiGenerated` is false. Both AI and
fallback messages are capped at 500 characters.

---

## Part 4: Follow-up review and fixes

Tool: OpenCode

### Prompt 5: Review the remaining work
Date: 23 Oct 2026
Result: reviewed commits 9 and 10 plus the in-memory dev script; found
documentation, test-coverage, and alert-reliability gaps

```
i have done the remainig work where u left off kindly review it.
```

### Prompt 6: Build the review fixes
Date: 23 Oct 2026
Result: bounded alert input/messages, added static-frontend and duplicate-check
tests, fixed refresh flicker, and updated docs and sample data

```
lets think step by step and start building
```

### Prompt 7: Fix the Groq reasoning model
Date: 23 Oct 2026
Result: switched to `max_completion_tokens`, added optional
`reasoning_effort`, raised the completion budget, and updated tests/docs

```
go with option b
```

---

## Part 5: Cleanup and hardening

Tool: Claude Code

### Prompt 8: Lint, DNS, scripts, and docs cleanup
Date: 24 Oct 2026
Result: attached original error as `cause` in `db.js`; allowed `no-console`
in `scripts/`; replaced hard-coded `dns.setServers` with a shared
`DNS_SERVERS` env-var helper (`src/config/dns.js`, tested, documented);
removed the non-existent `apiconfigs` deletion and added `npm run db:clean`;
added PowerShell sample commands to the README and created
`sample-assignment.json` with the two assignment-brief examples.
All changes landed as four focused commits, each gated by a passing
`npm run check`.

```
Fix these in order, one small commit each. Run npm run check before every
commit; it must pass (lint and tests).

1. fix(lint): in src/config/db.js attach the original error as the cause
   when rethrowing (new Error(message, { cause: error })). In
   eslint.config.js allow console only for files under scripts/ (CLI
   tools). Do not change any other lint rules.

2. fix(dns): remove every hard-coded dns.setServers call, in
   src/server.js AND scripts/clean-sample-data.js. Add a small shared
   helper (src/config/dns.js) that reads an optional DNS_SERVERS env var
   (comma-separated, e.g. 8.8.8.8,1.1.1.1) and calls dns.setServers
   only when it is set; default is the system DNS. Use it in both
   places. Add DNS_SERVERS (empty) to .env.example, document it in the
   README config table, and add a test for the parsing.

3. chore(scripts): in scripts/clean-sample-data.js remove the apiconfigs
   line (that collection does not exist in this app) and only delete the
   alerts and apistates collections. Add an npm script "db:clean" and
   document it in the README as "resets demo data (deletes all alerts and
   API failure counters), for demos only".

4. docs: in the README Sample data section add a PowerShell example
   (curl.exe -X POST http://localhost:3000/monitor -H "Content-Type:
   application/json" --data "@sample-data.json" and
   Invoke-RestMethod http://localhost:3000/alerts). Add
   sample-assignment.json with the two example items from the assignment
   brief (PatientDataAPI 1200 ms / 200 / 50 records, AppointmentAPI
   5500 ms / 500 / 0 records) and mention it in the README.

Then update PROGRESS.md and AI_Prompts.md (add this as a prompt entry
with its result).
```

### Prompt 9: Fix DNS override order and sample label
Date: 24 Oct 2026
Result: `src/config/dns.js` now loads dotenv itself so `DNS_SERVERS` from
`.env` works even when called before `env.js`; regression test spawns a
child process with a temp `.env`; `sample-assignment.json` PatientDataAPI
label corrected from "slow response" to "healthy".

```
Bug: DNS_SERVERS from .env is ignored because applyDnsOverride() runs
before dotenv loads (server.js calls it first; env.js loads dotenv later;
clean-sample-data.js has the same order). Fix: in src/config/dns.js load
dotenv at the top (require('dotenv').config({ quiet: true })) so
applyDnsOverride works wherever it is called. Add a test that proves it:
write a temp .env file in a temp working directory containing DNS_SERVERS,
spawn a node child process that requires dns.js, calls applyDnsOverride
and prints dns.getServers(), and assert the output. Also fix the label in
sample-assignment.json: the PatientDataAPI item (1200 ms, 200, 50 records)
is healthy, not "slow response". Run npm run check, commit as
"fix(dns): load .env before applying DNS override", and update PROGRESS.md
and AI_Prompts.md (Prompt 9).
```