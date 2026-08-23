# Stop Underquoting Runtime Duration

Status: resolved

Quick mode currently quotes 3–6 minutes for both Claude and Codex. Three completed Claude samples
took 6.8–9.3 persisted minutes, while Codex timed out after 15 minutes without completing discovery.

## Acceptance

- [x] Claude's estimate contains the observed 6.8–9.3 minute range.
- [x] Codex is not presented as having Claude's pace after a 15-minute discovery timeout.
- [x] OpenCode's estimate contains the observed 5.6–7.6 minute range.
- [x] Workload estimate tests cover all three runtimes.

## Answer

Quick-mode estimates now reflect current repeated measurements: Claude and OpenCode show 6–11
minutes; Codex shows 12–22 minutes. These remain operational ranges rather than guarantees.

Verification: `pnpm vitest run src/features/prospecting-runs/application/search-brief-preflight.test.ts`
passed all 6 tests.
