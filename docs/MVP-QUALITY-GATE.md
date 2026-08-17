# MVP quality gate

Version: `mvp-evaluation-v1`

The local MVP gate is exercised by `pnpm check`, `pnpm worker:check`, and `pnpm test:e2e`. The versioned evaluation set covers Polish source content, correct and ambiguous identities, a false-positive chain, no-site and inaccessible businesses, a strong existing site, and every Website Opportunity class. Identity precision is calculated in the fixture test and must remain at least 90%.

Durable task/restart tests prove committed checkpoints survive process restarts without repeating completed work. Run transitions, durations, attempts, sanitized failures, inspection blocks, runtime/schema versions, prompt/extraction/scoring/inspection versions, source timestamps, and assessment timestamps remain in SQLite. Runtime subprocess stderr, untrusted Source Content, provider credentials, and hidden reasoning are not persisted.

The application uses loopback Next.js, a separate Effect worker, SQLite, public discovery/inspection sources, and authenticated Codex or Claude Code subscription CLIs. It requires no Docker, cloud hosting, OpenRouter, or usage-based AI API credential. Export and review actions never initiate outreach.
