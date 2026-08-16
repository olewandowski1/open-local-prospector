# 03 — Create a confirmed Search Brief

**What to build:** Replace the disabled run action with a complete Search Brief and Run Preflight flow that interprets the requested Search Area and persists a pending Prospecting Run only after Oliver confirms its scope and readiness.

**Blocked by:** 01 — Prepare the Local Application; 02 — Detect subscription runtime readiness.

**Status:** resolved

- [x] Oliver can enter a city or municipality, an optional radius, one category preset or custom category, a target from 5 through 50, a Run Mode, and a ready runtime.
- [x] Geocoding displays the interpreted Search Area and requires explicit selection when results are ambiguous.
- [x] Poland is the initial default, but valid locations outside Poland are not rejected.
- [x] Run Preflight verifies SQLite, Brave Search, Playwright, disk space, and selected runtime readiness before enabling start.
- [x] Run Preflight estimates workload and likely duration without claiming a precise subscription cost.
- [x] The previous runtime and non-secret run defaults are restored without silently reusing an unconfirmed Search Area.
- [x] A confirmed submission creates exactly one persisted pending Prospecting Run; invalid, ambiguous, or unready submissions create none.
- [x] Browser and application tests cover boundary targets, custom categories, ambiguous Search Areas, non-Polish locations, and failed preflight.

## Answer

Implemented `/runs/new` as a complete shadcn Search Brief and preflight flow. Drafts and confirmed Search Areas are separate contracts; Poland is the unqualified-location default while explicitly qualified international locations remain valid. User-triggered Nominatim lookups are application-owned, one-request-per-second limited, response-bounded, cached in SQLite for seven days, provider-swappable, and visibly attributed with the required usage-policy notice.

Preflight combines SQLite, Brave Search, Playwright Chromium, disk, and the selected subscription-runtime status, plus an operational workload/duration range. Confirmation re-runs preflight, requires a canonical selected Search Area, persists a single idempotent Pending run and non-secret defaults transactionally, and never restores an unconfirmed location. Verified with `pnpm check` (85 tests and production build), targeted desktop/mobile browser coverage for ambiguous international custom briefs and failed preflight, and the complete browser suite after the overview navigation semantic fix.
