# Use subscription-runtime web search for discovery

Business discovery and identity corroboration use the web-search capability of the runtime selected in the Search Brief: Codex or Claude Code. The application does not require a separate search API, key, account, or fallback provider. This supersedes ADR 0005's Brave Search decision.

The application still owns the discovery plan, query bounds, runtime selection, retries, persistence, URL validation, deduplication, identity evaluation, and safe Playwright inspection. Runtime output must match a closed JSON schema and contain exact public source URLs. Search results, snippets, and page text are untrusted evidence data and never instructions. Runtime processes receive prompts through stdin, run without a shell in an isolated temporary directory, and are restricted to web search where the provider exposes tool-level controls.

Agent search does not expose stable provider-independent pagination, so each bounded query produces one page. Thorough mode increases query coverage instead of relying on an API-specific offset. A run never falls back to another runtime or a usage-based API; provider subscription limits and availability remain visible operational constraints.
