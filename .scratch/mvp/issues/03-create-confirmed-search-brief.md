# 03 — Create a confirmed Search Brief

**What to build:** Replace the disabled run action with a complete Search Brief and Run Preflight flow that interprets the requested Search Area and persists a pending Prospecting Run only after Oliver confirms its scope and readiness.

**Blocked by:** 01 — Prepare the Local Application; 02 — Detect subscription runtime readiness.

**Status:** ready-for-agent

- [ ] Oliver can enter a city or municipality, an optional radius, one category preset or custom category, a target from 5 through 50, a Run Mode, and a ready runtime.
- [ ] Geocoding displays the interpreted Search Area and requires explicit selection when results are ambiguous.
- [ ] Poland is the initial default, but valid locations outside Poland are not rejected.
- [ ] Run Preflight verifies SQLite, Brave Search, Playwright, disk space, and selected runtime readiness before enabling start.
- [ ] Run Preflight estimates workload and likely duration without claiming a precise subscription cost.
- [ ] The previous runtime and non-secret run defaults are restored without silently reusing an unconfirmed Search Area.
- [ ] A confirmed submission creates exactly one persisted pending Prospecting Run; invalid, ambiguous, or unready submissions create none.
- [ ] Browser and application tests cover boundary targets, custom categories, ambiguous Search Areas, non-Polish locations, and failed preflight.
