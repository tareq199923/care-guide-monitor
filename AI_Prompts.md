# AI Prompts Used

Tools: Claude Code (VS Code CLI) for planning and code generation,
Claude chat (claude.ai) for planning help and plan review.
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

Source: `src/services/aiAlert.js`. Settings: temperature `0.2`,
`max_tokens` `120`, timeout `LLM_TIMEOUT_MS`, and one retry.

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
writes a deterministic message and `aiGenerated` is false.