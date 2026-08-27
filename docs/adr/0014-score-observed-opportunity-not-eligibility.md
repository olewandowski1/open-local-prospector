# Score Observed Opportunity, Not Eligibility

Status: Proposed

Would amend [ADR 0006](0006-deterministic-opportunity-scoring.md).

ADR 0006 set the Opportunity Score at 40% opportunity severity, 25% evidence confidence, 15%
contactability, 10% local decision-making likelihood and 10% apparent commercial value, with 60 as
the qualification threshold. Now that website inspection captures pages, there is enough real data to
say what those weights actually do.

## Half the score is a constant

Across all 202 scores this workspace has ever produced:

- `contact_component` is **15 in every single score**. It has never taken another value, because
  `qualifiesOpportunityScore` already requires a Contact Route: a business without one cannot
  qualify regardless of its score.
- `local_decision_component` is **10 in every single score**. It has never taken another value,
  because centrally controlled businesses are excluded upstream as `national-chain` before they are
  ever scored. 13 of 164 canonical businesses are `Central`, and none of them reached scoring.
- `confidence_component` is **24 to 25 out of 25 for every one of the 8 candidates with captured
  pages**. It is the mean confidence of the Supporting Observations, which measures how sure the
  runtime is that it saw what it reports, not how large the opportunity is. A runtime reporting what
  is plainly on a page it just rendered is confident, so the component is near its maximum whenever
  evidence exists at all.

So roughly 49 of the 100 points are awarded before anything about the website is considered. The
score effectively reduces to:

```text
score ≈ 49 + (severity / 5) × 40 + apparentCommercialValue × 10
```

## What that costs

Severity is a 1-to-5 integer carrying 40 points, so it moves in 8-point steps and is the only real
discriminator. Two consequences are visible in the data:

- **A good website cannot fall below the threshold.** Auto Tytan Rumia renders in 280 ms, has no
  images missing alternative text, no unlabelled controls, no horizontal overflow, HTTPS and a
  descriptive title. Its one observed opportunity is that conversion relies on telephone and email
  rather than an enquiry form, at severity 2. It scores **72.8**. There is no severity low enough to
  reject it short of the runtime reporting no opportunity at all.
- **Severity cannot separate unlike defects.** Gabinet Dentystyczny Katarzyna Myśliwiec has five
  unlabelled controls and scores **81.75**. Auto-Serwis Marek Kin has nine unlabelled controls, two
  images missing alternative text and 404 errors, and scores **81.3**, slightly lower. Both are
  severity 3, so the 8-point band swallows the difference and the ranking is decided by apparent
  commercial value.

## Decision

Score what was observed about the website. Let the facts that decide eligibility gate the candidate
instead of paying it points.

- **Opportunity severity: 65%** (from 40%).
- **Apparent commercial value: 35%** (from 10%).
- **Contactability, local decision-making likelihood and evidence confidence stop being score
  components.** Contactability and local scope already gate qualification and exclusion. Evidence
  confidence becomes a validity gate: an opportunity whose Supporting Observations fall below a
  confidence floor is not counted, rather than scoring proportionally to how certain the runtime
  feels.
- **A Candidate Business qualifies at 60 or above and at severity 2 or above.** A severity-1
  observation is a remark, not an opportunity worth a reader's time.
- The blocked-inspection limits from the current rubric stay: with no page captured, severity is
  capped at 4 of 5. The confidence cap becomes redundant once confidence no longer scores.

Modelled against every score in the workspace, this qualifies 115 rather than 120 candidates, and
reorders them by what was actually seen:

| Business | Inspection | Severity | Now | Proposed |
|---|---|---|---|---|
| Katarzyna Myśliwiec | Complete | 3 | 81.75 | 67.0 |
| Astodent | Complete | 3 | 81.3 | 66.3 |
| Auto-Serwis Marek Kin | Complete | 3 | 81.3 | 66.3 |
| Jimmy Serwis | Partial | 3 | 81.25 | 66.3 |
| Rumia Motors | Partial | 2 | 74.35 | 56.1 (drops out) |
| DIAMOND Auto Serwis | Partial | 2 | 73.4 | 54.7 (drops out) |
| Auto Tytan Rumia | Complete | 2 | 72.8 | 53.3 (drops out) |
| F.H.U SAMLI | Partial | 2 | 72.5 | 48.75 (drops out) |

A business with no website at all, at severity 4 and apparent commercial value 0.8, scores 80. A
business whose website could not be observed, capped at severity 4 with value 0.5, scores 69.5. An
observed website with real defects scores in the mid 60s. A well-built website with a minor
conversion remark drops out. That ordering says what the product means: the strongest opportunity is
a business with no website, then one we could not see, then one we saw and found wanting.

## Consequences

- Scores are not comparable across rubric versions, which `rubric_version` already records. Existing
  scores keep their recorded rubric and are not recalculated; a business is rescored by
  reassessment.
- The score becomes coarser, not finer: with 65 points on a 1-to-5 integer the step is 13 points.
  Separating five unlabelled controls from nine plus 404 errors needs the runtime to use the severity
  range, or needs severity to stop being an integer. This ADR does not solve that, and it is the
  obvious next question.
- Removing contactability and local scope from the score removes the only place they were visible to
  a reader. The Score Explanation must still say why a business is eligible, or that reasoning
  disappears from the panel.
- A confidence floor can silently discard an opportunity. It must be counted and shown, in the way
  ADR 0013 requires dropped discovery claims to be counted rather than repaired.
- `evaluate-fixtures` and the MVP evaluation expectations change wholesale, and the qualification
  threshold of 60 is inherited untested against the new distribution. It should be chosen from the
  reordered data rather than assumed.

## Alternative considered

Adding an evidence-strength component, scoring a Complete inspection above a Partial one, was
rejected. `Partial` conflates two unlike situations: a one-page site where there was no second page
to visit, and an inspection that failed to reach one. DIAMOND Auto Serwis is a genuine one-page site,
and penalising it for the pages it does not have would repeat the mistake this rubric change is meant
to correct.
