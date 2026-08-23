# Reliability And UX Audit

Audit repeated Prospecting Runs, runtime consistency, recovery paths, and the complete local-user
workflow. Record each independently verifiable correction as a numbered issue.

## Answer

The controlled matrix used the same Quick Search Brief for Beauty Salons in Reda, target 5, with
Explicit Reassessment. Claude and OpenCode each completed twice through the real UI and worker.
Codex exposed two independent failures: an invalid optional output-schema property, which is fixed,
and a discovery report that timed out after 15 minutes with no persisted result.

### Runtime Results

| Runtime | Outcome | Discoveries | Exclusions | Assessments | Qualified | Persisted Duration |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Claude 1 | Target Reached | 12 | 3 | 9 | 9 | 7.8 min |
| Claude 2 | Target Reached | 10 | 1 | 9 | 9 | 6.8 min |
| OpenCode 1 | Search Exhausted | 10 | 7 | 3 | 3 | 5.6 min |
| OpenCode 2 | Completed With Warnings | 10 | 3 | 6 | 6 | 7.6 min |
| Codex | Runtime Unavailable | 0 | 0 | 0 | 0 | 15 min timeout |

Claude's two nine-candidate sets shared four exact names. Their shared scores moved by 1.5 to 9.6
points. OpenCode's sets shared two exact names; their scores moved by 2.8 and 6.6 points. OpenCode's
first run excluded seven businesses as identity-ambiguous; its second excluded three for missing
verified Contact Routes. The deterministic verification boundary consistently withheld ambiguous
or unsupported records rather than repairing or presenting them.

### UX And Reliability Coverage

The production workflow was exercised across overview, Search Brief and preflight, run creation,
progress polling, pause/resume/cancel, partial failures and Technical Run Log, run list table/cards,
candidate review without losing queue context, evidence loading, filters, responsive layouts,
runtime selection, appearance, storage, suppression, deletion failure handling, backup, restore and
reset confirmation. The isolated suite passed 71 cases and skipped 60 inapplicable or opt-in live
cases; one overview-scroll case timed out under three-worker runtime-probe contention and passed on
an immediate isolated desktop/mobile rerun.

The largest remaining product gap is first-class comparison: Runs can be inspected individually,
but the application does not calculate overlap, exclusions, score drift, or runtime-duration drift
for repeated Search Briefs. The live reporter added by this audit makes those comparisons
reproducible for development, but it is not yet a reader-facing comparison workspace.
