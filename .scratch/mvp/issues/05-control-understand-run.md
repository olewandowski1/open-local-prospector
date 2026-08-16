# 05 — Control and understand a Prospecting Run

**What to build:** Give Oliver a real Runs workspace where persisted progress is understandable and a running job can be paused or cancelled without losing completed work.

**Blocked by:** 04 — Execute and recover durable Prospecting Runs.

**Status:** ready-for-agent

- [ ] Run Progress shows the current stage and counts for queries, discoveries, duplicates, exclusions, websites, assessments, qualified candidates, blocked inspections, and target remaining.
- [ ] Per-business details show current stage, source events, retry count, and any failure or exclusion reason.
- [ ] Pause finishes the active atomic step and prevents new claims; resume continues from persisted checkpoints.
- [ ] Cancel preserves completed results and prevents new work.
- [ ] Every terminal result uses a documented Run Completion State.
- [ ] One failed business cannot alone produce Infrastructure Failed.
- [ ] A separate Technical Run Log retains generated queries, source identifiers, timestamps, result URLs, transitions, retries, and errors.
- [ ] The UI and logs never expose hidden chain-of-thought or mislabel generated prose as execution progress.
- [ ] Polling and browser tests cover active progress, pause/resume, cancellation, partial failure, and terminal completion.
