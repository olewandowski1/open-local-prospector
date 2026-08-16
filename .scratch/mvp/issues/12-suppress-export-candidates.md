# 12 — Suppress and export reviewed candidates

**What to build:** Let Oliver enforce Do Not Contact decisions globally and export only the reviewed, unsuppressed Candidate Business data he explicitly chooses.

**Blocked by:** 11 — Review and correct Candidate Businesses.

**Status:** ready-for-agent

- [ ] A Suppression Entry prevents future recommendation, reassessment for outreach, and export across all Prospecting Runs.
- [ ] Suppression retains only the minimum data necessary to enforce the request.
- [ ] CSV and JSON export support the active Review Queue filters and deterministic sorting.
- [ ] Exports include evidence links, score breakdown and rubric version, assessment timestamp, Review Status, and selected Contact Routes.
- [ ] Named professional contact data is excluded by default and requires an explicit inclusion choice.
- [ ] Suppressed records are excluded regardless of filters or direct selection.
- [ ] Export performs no outreach and does not change Review Status to Contacted.
- [ ] Automated tests cover suppression across runs, safe contact defaults, CSV escaping, JSON shape, stable ordering, and empty exports.
