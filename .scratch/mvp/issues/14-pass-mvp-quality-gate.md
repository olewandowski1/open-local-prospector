# 14 — Pass the MVP quality gate

**What to build:** Prove the complete Local Application can execute and resume a bounded run, produce trustworthy evidence-backed candidates, support human review, and export safe results using only local infrastructure and subscription runtimes.

**Blocked by:** 12 — Suppress and export reviewed candidates; 13 — Execute assessments with Claude Code and OpenCode.

**Status:** ready-for-agent

- [ ] Versioned Evaluation Fixtures cover Polish content, correct and ambiguous identities, false-positive identities, no-site businesses, strong existing sites, inaccessible sites, and every Website Opportunity class.
- [ ] Fixtures require citation presence for every emitted opportunity and zero inferred or generated Contact Routes.
- [ ] Identity Precision is measured and reaches at least 90% on the approved evaluation set before completion is claimed.
- [ ] Restart acceptance proves completed work survives web and worker termination without unnecessary repeated stages.
- [ ] A Quick run targeting 10 qualified candidates records stage duration, retries, runtime/schema failures, inspection blocks, and Shortlist Yield inputs toward the provisional duration target.
- [ ] Prompt, extraction schema, scoring rubric, inspection configuration, runtime name/version, source timestamps, and assessment timestamps are retained with each Website Assessment.
- [ ] Diagnostic output is explicit and sanitized, containing no secrets, Source Content by default, unnecessary personal data, or hidden chain-of-thought.
- [ ] The complete flow requires no Docker, cloud hosting, OpenRouter, or usage-based AI API credentials.
- [ ] The documented V1 completion gate is exercised end to end: configure, run, resume, review, correct, suppress, and export.
