# 06 — Discover businesses through Brave Search

**What to build:** Let the worker turn a confirmed Search Brief into persisted Discovered Businesses using application-generated Brave Search queries and transparent source history.

**Blocked by:** 05 — Control and understand a Prospecting Run.

**Status:** ready-for-agent

- [ ] Brave Search implements the application-owned `DiscoverySource` contract and receives only bounded queries derived from the Search Brief.
- [ ] The Brave API key is loaded only by the server/worker boundary and is never sent to a runtime, browser client, log, or persisted record.
- [ ] Discovery records source identifiers, query text, result URLs, timestamps, and normalized raw business attributes.
- [ ] Repeated results are recognized as duplicate discovery inputs without prematurely claiming a confirmed Business Identity.
- [ ] Discovery continues until the requested Candidate Business target is reached or repeated queries stop yielding unique eligible inputs.
- [ ] Search exhaustion becomes a visible Run Completion State with partial results preserved.
- [ ] The implementation does not scrape consumer search-result pages or introduce paid/private business datasets.
- [ ] Adapter fixtures and an end-to-end fake source prove query limits, pagination, deduplication inputs, API failure classification, and progress reporting.
