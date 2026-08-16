# 08 — Perform safe Quick website inspection

**What to build:** Inspect each confirmed public website with an isolated application-owned browser and persist the observable evidence needed for assessment and manual review.

**Blocked by:** 07 — Corroborate Business Identity and eligibility.

**Status:** resolved

- [x] Quick mode visits the homepage and the most relevant enquiry, booking, service, or purchasing page.
- [x] Playwright uses an isolated temporary profile containing no personal cookies, credentials, extensions, history, or downloads.
- [x] Navigation blocks localhost and aliases, private/link-local ranges, file/custom protocols, downloads, pop-ups, and unapproved cross-origin destinations.
- [x] Authentication, CAPTCHA, automation blocks, access limits, and platform interstitials produce a recorded Inspection Block and are never bypassed.
- [x] Inspection stores final URLs, timestamps, rendered text, metadata, relevant links/forms, and required console/network failures.
- [x] Desktop and mobile screenshots plus deterministic performance/page-quality measurements are stored as filesystem artifacts referenced by database metadata.
- [x] Whole websites are not copied and Source Content is never treated as an instruction or authorization.
- [x] Network-policy and Evaluation Fixtures prove private destinations and unsafe protocols are rejected while approved public resources render normally.

**Answer:** Added an application-owned Quick inspector using fresh non-persistent Playwright contexts for desktop and mobile, with downloads and service workers disabled. Context-wide routing resolves every HTTP(S) hostname and blocks local aliases, private/link-local/special-use addresses, unsafe protocols, credential URLs, WebSockets, popups, and unexpected top-level cross-origin navigation. The inspector records access/rate/CAPTCHA/automation barriers without bypass, visits only the homepage and highest-ranked same-site enquiry path, and bounds rendered text, links, forms, failures, and viewport screenshots. SQLite references screenshot size/hash/path and retains page metadata, final URLs, deterministic measurements, and Inspection Blocks; no HTML site copy is stored. Verified with real Chromium fixture rendering, network-policy fixtures, 152 total tests, production build, worker readiness, and the full browser suite (18 passed, 2 expected platform skips).
