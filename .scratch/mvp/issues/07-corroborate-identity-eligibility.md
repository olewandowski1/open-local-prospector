# 07 — Corroborate Business Identity and eligibility

**What to build:** Convert Discovered Businesses into trustworthy Candidate Businesses by corroborating identity, finding public Online Presence and Contact Routes, and retaining explainable exclusions.

**Blocked by:** 06 — Discover businesses through Brave Search.

**Status:** ready-for-agent

- [ ] Business Identity is corroborated using multiple available signals such as name, Search Area, address, telephone, and reciprocal links.
- [ ] Ambiguous website or social-profile associations remain visibly ambiguous and are never treated as confirmed.
- [ ] Canonical Business Identity is reused across Prospecting Runs while each assessment remains historical.
- [ ] National chains, centrally controlled franchises, online-only businesses, and businesses whose website decisions are unlikely to be local are excluded with retained reasons.
- [ ] Website, social profile, directory, and Contact Route discovery uses only publicly accessible pages.
- [ ] A Candidate Business requires at least one public Contact Route before entering the Review Queue.
- [ ] Generic business routes are preferred; named professional details are collected only when essential, explicitly public for that role, and never inferred.
- [ ] Every Contact Route stores its type, source URL, and collection date.
- [ ] Recently assessed businesses are skipped by default, with distinct include-without-reassessment and explicit-reassessment choices.
- [ ] Evaluation Fixtures cover correct, ambiguous, duplicate, chain, franchise, online-only, no-site, and missing-contact cases.
