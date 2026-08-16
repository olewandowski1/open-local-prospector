# 11 — Review and correct Candidate Businesses

**What to build:** Give Oliver a persistent Review Workspace for comparing evidence, recording his decisions, and correcting machine-produced assertions without destroying assessment history.

**Blocked by:** 10 — Score and rank the Review Queue.

**Status:** ready-for-agent

- [ ] The Review Workspace uses a ranked list and persistent detail pane that retains filters and selection while reviewing.
- [ ] Details expose score breakdown, Website Opportunities, Supporting Observations, screenshots, measurements, Online Presence, Contact Routes, source history, and inspection limitations.
- [ ] Evidence is visibly distinguished as confirmed fact, AI assessment, ambiguous identity, missing evidence, or Inspection Block.
- [ ] User Corrections can change identity links, Online Presence links, Contact Routes, opportunity classifications, and Supporting Observations.
- [ ] Original machine-produced assessments remain immutable and available in history after correction.
- [ ] Review Status supports Unreviewed, Shortlisted, Rejected, Contacted, and Archived.
- [ ] Rejected requires a predefined reason or Other with a note.
- [ ] Private Review Notes and an optional follow-up date persist locally but never initiate outreach or infer Review Status.
- [ ] Browser and persistence tests cover correction history, rejection validation, status changes, notes, refresh, and list/detail continuity.
