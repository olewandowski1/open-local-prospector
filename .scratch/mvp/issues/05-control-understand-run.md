# 05 — Control and understand a Prospecting Run

**What to build:** Give Oliver a real Runs workspace where persisted progress is understandable and a running job can be paused or cancelled without losing completed work.

**Blocked by:** 04 — Execute and recover durable Prospecting Runs.

**Status:** resolved

- [x] Run Progress shows the current stage and counts for queries, discoveries, duplicates, exclusions, websites, assessments, qualified candidates, blocked inspections, and target remaining.
- [x] Per-business details show current stage, source events, retry count, and any failure or exclusion reason.
- [x] Pause finishes the active atomic step and prevents new claims; resume continues from persisted checkpoints.
- [x] Cancel preserves completed results and prevents new work.
- [x] Every terminal result uses a documented Run Completion State.
- [x] One failed business cannot alone produce Infrastructure Failed.
- [x] A separate Technical Run Log retains generated queries, source identifiers, timestamps, result URLs, transitions, retries, and errors.
- [x] The UI and logs never expose hidden chain-of-thought or mislabel generated prose as execution progress.
- [x] Polling and browser tests cover active progress, pause/resume, cancellation, partial failure, and terminal completion.

**Answer:** Added SQLite-backed run progress, per-business task details, factual technical events, and safe pause/resume/cancel controls. Leased work finishes atomically, checkpoints survive controls and failures, business-local infrastructure failures complete with warnings, and terminal states use the documented completion vocabulary. Verified with 100 unit/integration tests, a production build, the worker composition check, and the full Chromium desktop/mobile suite (18 passed, 2 expected platform skips).
