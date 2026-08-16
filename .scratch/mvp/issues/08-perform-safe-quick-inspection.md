# 08 — Perform safe Quick website inspection

**What to build:** Inspect each confirmed public website with an isolated application-owned browser and persist the observable evidence needed for assessment and manual review.

**Blocked by:** 07 — Corroborate Business Identity and eligibility.

**Status:** ready-for-agent

- [ ] Quick mode visits the homepage and the most relevant enquiry, booking, service, or purchasing page.
- [ ] Playwright uses an isolated temporary profile containing no personal cookies, credentials, extensions, history, or downloads.
- [ ] Navigation blocks localhost and aliases, private/link-local ranges, file/custom protocols, downloads, pop-ups, and unapproved cross-origin destinations.
- [ ] Authentication, CAPTCHA, automation blocks, access limits, and platform interstitials produce a recorded Inspection Block and are never bypassed.
- [ ] Inspection stores final URLs, timestamps, rendered text, metadata, relevant links/forms, and required console/network failures.
- [ ] Desktop and mobile screenshots plus deterministic performance/page-quality measurements are stored as filesystem artifacts referenced by database metadata.
- [ ] Whole websites are not copied and Source Content is never treated as an instruction or authorization.
- [ ] Network-policy and Evaluation Fixtures prove private destinations and unsafe protocols are rejected while approved public resources render normally.
