# Make Live Run Audits Completable

Status: resolved

The opt-in live browser tests use the ordinary isolated browser server, which starts Next.js but no
worker. They can create a Prospecting Run but cannot execute it. The OpenCode smoke test also still
expects the old reasoning label after Ox Alpha's supported variants were corrected.

## Acceptance

- [x] Live audits use a dedicated, disposable workspace and start both the web process and worker.
- [x] The live configuration runs only desktop live-run specifications, serially.
- [x] OpenCode assertions reflect the configured Ox Alpha reasoning variant.
- [x] A repeatable cross-runtime matrix runs the same Search Brief twice per runtime.
- [x] Static checks and non-live browser tests remain green.

## Answer

Added a dedicated live Playwright configuration on port 4313. It creates a disposable database,
starts both Next.js and the worker, uses one desktop worker, and keeps ordinary E2E runs free of
subscription usage. The matrix explicitly reassesses recent businesses so repetition two remains
comparable instead of silently skipping repetition one's businesses.

Two Claude and two OpenCode repetitions completed through the real UI and worker. Codex exposed a
separate schema defect and discovery timeout; its repaired structure boundary was verified directly.
