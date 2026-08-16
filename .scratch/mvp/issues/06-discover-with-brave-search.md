# 06 — Discover businesses through Brave Search

**What to build:** Let the worker turn a confirmed Search Brief into persisted Discovered Businesses using application-generated Brave Search queries and transparent source history.

**Blocked by:** 05 — Control and understand a Prospecting Run.

**Status:** resolved

- [x] Brave Search implements the application-owned `DiscoverySource` contract and receives only bounded queries derived from the Search Brief.
- [x] The Brave API key is loaded only by the server/worker boundary and is never sent to a runtime, browser client, log, or persisted record.
- [x] Discovery records source identifiers, query text, result URLs, timestamps, and normalized raw business attributes.
- [x] Repeated results are recognized as duplicate discovery inputs without prematurely claiming a confirmed Business Identity.
- [x] Discovery continues until the requested Candidate Business target is reached or repeated queries stop yielding unique eligible inputs.
- [x] Search exhaustion becomes a visible Run Completion State with partial results preserved.
- [x] The implementation does not scrape consumer search-result pages or introduce paid/private business datasets.
- [x] Adapter fixtures and an end-to-end fake source prove query limits, pagination, deduplication inputs, API failure classification, and progress reporting.

**Answer:** Added a worker-only Brave Web Search adapter behind the application-owned discovery contract, with official query/page bounds, response-size and shape validation, safe error classification, and no token persistence or client exposure. SQLite now stores deterministic query history, normalized discovered inputs, every source occurrence, duplicate-input flags, factual technical events, and atomic progress metrics. Deterministic restart behavior skips completed pages; discovery stops at the target or after repeated non-unique pages and records `Search Exhausted` with partial data. Verified with adapter fixtures, a durable-worker fake-source path, 111 total unit/integration tests, a production build, worker readiness, and the full Chromium desktop/mobile suite (18 passed, 2 expected platform skips).
