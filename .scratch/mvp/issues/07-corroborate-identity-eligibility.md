# 07 — Corroborate Business Identity and eligibility

**What to build:** Convert Discovered Businesses into trustworthy Candidate Businesses by corroborating identity, finding public Online Presence and Contact Routes, and retaining explainable exclusions.

**Blocked by:** 06 — Discover businesses through Brave Search.

**Status:** resolved

- [x] Business Identity is corroborated using multiple available signals such as name, Search Area, address, telephone, and reciprocal links.
- [x] Ambiguous website or social-profile associations remain visibly ambiguous and are never treated as confirmed.
- [x] Canonical Business Identity is reused across Prospecting Runs while each assessment remains historical.
- [x] National chains, centrally controlled franchises, online-only businesses, and businesses whose website decisions are unlikely to be local are excluded with retained reasons.
- [x] Website, social profile, directory, and Contact Route discovery uses only publicly accessible pages.
- [x] A Candidate Business requires at least one public Contact Route before entering the Review Queue.
- [x] Generic business routes are preferred; named professional details are collected only when essential, explicitly public for that role, and never inferred.
- [x] Every Contact Route stores its type, source URL, and collection date.
- [x] Recently assessed businesses are skipped by default, with distinct include-without-reassessment and explicit-reassessment choices.
- [x] Evaluation Fixtures cover correct, ambiguous, duplicate, chain, franchise, online-only, no-site, and missing-contact cases.

**Answer:** Added bounded application-owned identity-evidence queries and a deterministic corroboration policy using name, Search Area, address, telephone, repeated presence, contact, and reciprocal-link signals. SQLite now retains canonical identities across runs, run-local decisions and reasons, ambiguous associations, public website/social/directory presence, and typed Contact Routes with source URL and collection time. Chain, centrally controlled franchise, online-only, missing-contact, and uncertain matches are retained but excluded; named email addresses are not collected. Search Briefs now explicitly choose skip, include-existing, or reassess behavior for recently assessed identities. Verified with all requested evaluation fixtures, canonical reuse and recent-policy integration tests, 128 total tests, production build, worker readiness, and Chromium desktop/mobile Search Brief flows.
