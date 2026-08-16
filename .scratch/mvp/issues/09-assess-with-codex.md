# 09 — Assess evidence with the Codex runtime

**What to build:** Use Oliver's authenticated Codex subscription to turn inspected public evidence into schema-constrained Website Opportunities and Supporting Observations without giving the runtime authority over application actions.

**Blocked by:** 02 — Detect subscription runtime readiness; 08 — Perform safe Quick website inspection.

**Status:** resolved

- [x] The Codex executable is launched directly with fixed application-owned arguments, no shell, bounded standard input/output, timeout, cancellation, and output-size limits.
- [x] Application instructions and untrusted Source Content are clearly delimited and sent through standard input only.
- [x] The runtime receives no general shell, browser, persistence, discovery, scoring, or outreach capability.
- [x] Output must satisfy a versioned Effect Schema containing only the fields allowed for the assessment stage.
- [x] Every Website Opportunity includes at least one source-linked Supporting Observation with timestamp and Evidence State.
- [x] Aesthetic classifications are accepted only when tied to observable effects such as legibility, hierarchy, layout, trust, content clarity, or conversion flow.
- [x] Invalid or out-of-stage output follows the bounded stage retry policy and otherwise becomes a visible Runtime Unavailable or warning outcome.
- [x] Failure never silently selects another provider or invokes an API fallback, and provider credentials are never read or persisted.
- [x] Prompt-injection, malformed-output, unsupported-claim, missing-citation, and no-inferred-contact fixtures all fail safely.
