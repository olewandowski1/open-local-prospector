# Score Measured Defects, Not Evidence Confidence

Status: Accepted

Amends [ADR 0006](0006-deterministic-opportunity-scoring.md).

ADR 0006 set the Opportunity Score at 40% opportunity severity, 25% evidence confidence, 15%
contactability, 10% local decision-making likelihood and 10% apparent commercial value, with 60 as
the qualification threshold. Once website inspection began capturing pages, those weights could be
tested against real evidence. This ADR began as a proposal to reweight them, which testing rejected.

## Most of the score was a constant

Across all 202 scores the workspace had produced before this change:

- `contact_component` was **15 in every single score**, because `qualifiesOpportunityScore` already
  requires a Contact Route.
- `local_decision_component` was **10 in every single score**, because centrally controlled
  businesses are excluded upstream as `national-chain` before scoring.
- `confidence_component` was **24 to 25 out of 25 for every candidate with captured pages**. It is
  the mean confidence of the Supporting Observations, which measures how sure the runtime is that it
  saw what it reports, not how large the opportunity is.

About 49 of 100 points were awarded before anything about the website was considered, leaving two
varying inputs, one of them an integer from 1 to 5.

## Reweighting was the wrong lever

Because only two inputs varied, any reweighting is a monotone rescale. Run through the real
`calculateOpportunityScore` against every stored score, severity 65 / value 35, 80 / 20 and 85 / 15
each qualified the **same 117 businesses**, against 120 under the original weights. They were
indistinguishable from one another, and ranked the eight candidates with captured pages identically,
with the same inversions against a defect burden taken purely from the measurements.

A 65 / 35 split would also have been worse in one respect: it lets apparent commercial value, a
wholly unmeasured runtime judgement, outweigh 2.69 severity bands against 1.25 before.

## The problem was that severity had saturated

With every observed candidate assessed under `website-assessment-v4`, severity was distributed
`{0: 1, 2: 1, 3: 6}`. Six of eight sat in one band, scoring 80.95 to 81.95: a **one-point spread
across a five-fold range of measured defects**. Ranking inside the queue was arbitrary, with
thirteen unlabelled controls scoring below eleven and four scoring near nine.

Reweighting cannot fix that, because the input itself carries no resolution.

## Decision

Replace evidence confidence with an observed-defect component, computed by application code from the
measurements the inspection already records. Severity, contactability, local decision-making and
apparent commercial value keep their weights.

- **Opportunity severity 40%, observed defects 25%, contactability 15%, local decision-making 10%,
  apparent commercial value 10%.** The threshold stays at 60.
- The component is the mean defect density of the **captured pages**, not the total, so a site is
  judged by how defective a typical page is rather than by how many pages were inspected. Within a
  page, unlabelled controls carry 0.4, images missing alternative text 0.25, horizontal overflow
  0.15, a page not served over HTTPS 0.2, and first contentful paint between 1.5 s and 4.5 s up to
  0.2. Counts saturate at eight so one very poor page cannot swamp the score.
- **A measurement that was never recorded is not a defect.** Only an explicit negative counts, so an
  absent `usesHttps` does not read as insecure.
- **Having no website at all scores the component in full.** That is knowledge of absence, not
  absence of knowledge: there is no worse state for a website than not existing, and the inspection
  records `NoWebsite` from confirmed public presence rather than assuming it.
- **A blocked inspection scores the component at zero.** Nothing was observed, so nothing is claimed.
  This replaces the confidence half of the blocked-inspection limits; the severity cap of 4 of 5
  stays.
- Persisted as `observed_defect_component` under rubric `opportunity-score-v3`. Existing rows keep
  `confidence_component` and their recorded rubric, and are not recalculated.

## What it does to real candidates

The eight candidates with captured pages, rescored through the worker:

| Business | Worst unlabelled controls | Severity | Before | After |
|---|---|---|---|---|
| Auto-Serwis Marek Kin | 9 | 3 | 81.30 | 68.76 |
| DIAMOND Auto Serwis | 13 | 3 | 81.75 | 67.60 |
| Rumia Motors | 11 | 3 | 81.95 | 67.20 |
| Katarzyna Myśliwiec | 5 | 3 | 81.75 | 63.05 |
| Astodent | 4 | 3 | 80.95 | 62.00 |
| Jimmy Serwis | 3 | 3 | 81.55 | 61.20 |
| Auto Tytan Rumia | 0 | 0 | 72.80 | 33.61 (rejected) |
| F.H.U SAMLI | 0 | 0 | 72.50 | 33.53 (rejected) |

The spread across the six the runtime placed in one severity band went from **1.00 to 7.56 points**,
and the order now follows the measurements. The two sites with no measured defect fell out of
Candidates.

## Consequences

- Scores are not comparable across rubric versions, which `rubric_version` records. A business is
  rescored by reassessment, so a workspace holds both until its candidates are reassessed.
- Counts saturate at eight, so thirteen unlabelled controls and eleven score the same density and are
  separated only by apparent commercial value. Raising the ceiling would spread the top of the range
  but compress the bottom, where most sites sit. This is a calibration choice, and the ceiling is the
  first thing to revisit if the ranking looks wrong.
- The component measures what the inspection can count. Conversion journey, content clarity and
  discoverability remain entirely in the runtime's severity, so a site can still be poor in ways the
  score cannot see.
- Severity remains an integer from 1 to 5 carrying 40 points. `website-assessment-v4` made it track
  the measurements rather than the site's overall polish, but it still moves in 8-point steps and the
  runtime still tends to one band. A severity floor for qualification was considered and deferred:
  it should be calibrated from severities the current prompt produced, and it is now less pressing
  because the defect component supplies the resolution the floor was meant to approximate.
- The evaluation fixtures were re-tuned, since a fixture page carrying no measurements scored nothing
  on a component that reads measurements. `threshold-at` and `threshold-below` again straddle 60 by
  design, at 60.00 and 59.92.
