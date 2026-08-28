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

- **Opportunity severity 55%, observed defects 10%, contactability 15%, local decision-making 10%,
  apparent commercial value 10%.** The threshold stays at 60.
- The component reads the **worst captured page**, not the mean. Averaging was tried first and hid a
  home page that took 3.4 seconds to paint behind three fast pages, which is the page a visitor lands
  on. Within a page, unlabelled controls carry 0.4, images missing alternative text 0.25, horizontal
  overflow 0.15, a page not served over HTTPS 0.2, and first contentful paint between 1.5 s and 4.5 s
  up to 0.2. Counts saturate at eight, which keeps the component bounded and is the first thing to
  revisit if the ranking looks wrong.
- **A measurement that was never recorded is not a defect.** Only an explicit negative counts, so an
  absent `usesHttps` does not read as insecure.
- **Having no website at all scores the component in full.** That is knowledge of absence, not
  absence of knowledge: there is no worse state for a website than not existing, and the inspection
  records `NoWebsite` from confirmed public presence rather than assuming it.
- **A blocked inspection scores the component at zero.** Nothing was observed, so nothing is claimed.
  This replaces the confidence half of the blocked-inspection limits; the severity cap of 4 of 5
  stays.
- Persisted as `observed_defect_component` under rubric `opportunity-score-v4`. Existing rows keep
  `confidence_component` and their recorded rubric, and are not recalculated.

## What it does to real candidates

The eight candidates with captured pages, at the intermediate 25% weighting that this ADR corrects
below. The spread is the point: the runtime had placed six of them in one severity band.

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

The spread across those six went from **1.00 to 7.56 points** and the order followed the
measurements. But the two sites with no measured defect fell out of Candidates, and one of them
should not have.

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
- Severity remains an integer from 1 to 5, now carrying 55 points, so it moves in 11-point steps and
  the runtime still tends to one band. A severity floor for qualification was considered and deferred:
  it should be calibrated from severities produced once the runtime can see the pages.
- The evaluation fixtures were re-tuned, since a fixture page carrying no measurements scored nothing
  on a component that reads measurements. `threshold-at` and `threshold-below` again straddle 60 by
  design, at 60.00 and 59.90.

## Corrected after release

The component first carried 25% and averaged across pages. Both were wrong, and a real candidate
showed it. Auto Tytan Rumia measures clean, with no unlabelled controls, no missing alternative
text, HTTPS and no overflow, yet its first screen is a dated photograph with no visible call to
action and its only form is a search box. At 25% the component took a quarter of the score away
from exactly the business the product exists to find, and averaging reduced its 3.4 second home
page to 0.81 of 25 points.

Measurements are good at separating sites the runtime rated alike and bad as a gate, because a site
can measure clean and still be why a business needs a new website. They now break ties at 10% while
severity carries the judgement at 55%.

The deeper cause was not the rubric. The assessment had never been shown a screenshot, so it judged
presentation from body text and had no way to see a wasted first screen. See
[ADR 0004](0004-application-owned-browser-inspection.md). With the screenshot attached, the same site
moved from no finding at all to a dated first screen with no visible action, severity 3.

## Reproducibility

Rescoring the same business twice on the same captured evidence now moves the total by 1.3 points
at most, with severity identical across runs. Before the runtime was shown the pages, the same
three businesses swung by 34, 12 and 23 points, because severity was guessed from body text.

What remains is apparent commercial value, a runtime judgement that varied between 6.8 and 8.4 for
one business. First contentful paint was removed from the measured component for the same reason:
one home page measured 296 ms and 3,448 ms across runs, so it moved the total by up to 2 points on
network conditions. Paint time is still recorded, shown to the reader and given to the runtime, it
simply no longer moves the deterministic score.

Candidates within about 1.3 points of each other are therefore ties, and their order between runs
is arbitrary.

That mattered while the runtime placed almost everything in severity band 3, which left the
qualified set spanning 66.3 to 70.6 and inverted it: a garage with a visible telephone, navigation
and hero action scored above one whose first screen offered no way to act, because the better-built
site had measurable accessibility defects to find. Anchoring the bands in the prompt separated them.
A first screen with no visible telephone, enquiry or booking action is a 4, an accessibility or
layout defect on a page a visitor can still complete is a 3 at most however many instances it has,
and at most one opportunity is raised per class. The same three businesses then spread across 13.4
points rather than 2.5, and ordered by what the visitor loses.
