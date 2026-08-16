# 10 — Score and rank the Review Queue

**What to build:** Calculate explainable Opportunity Scores in application code and replace the sample overview with a real ranked Review Queue of evidence-backed Candidate Businesses.

**Blocked by:** 09 — Assess evidence with the Codex runtime.

**Status:** resolved

- [x] Application code calculates the versioned 0–100 score from severity 40%, observation confidence 25%, Contact Route availability 15%, local decision likelihood 10%, and apparent commercial value 10%.
- [x] The initial Review Queue threshold is 60 and no individual opportunity class, including no website, guarantees qualification or top rank.
- [x] Every score persists its rubric version and exposes a component-by-component explanation.
- [x] Only eligible, unsuppressed Candidate Businesses with Supporting Observations and a Contact Route enter the Review Queue.
- [x] Candidate summaries show identity, location, score, primary opportunity, website/contact availability, confidence, inspection state, Review Status, and two leading observations.
- [x] The overview uses persisted read models and no longer presents sample runs or Candidate Businesses as current data.
- [x] Deterministic fixtures cover thresholds, ties, missing components, strong existing websites, and false-positive opportunities.
- [x] Browser tests demonstrate ordering, empty state, partial/blocked evidence, and score explanations without relying solely on screenshots.
