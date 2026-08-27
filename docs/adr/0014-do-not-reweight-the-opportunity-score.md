# Do Not Reweight The Opportunity Score

Status: Proposed

Would amend [ADR 0006](0006-deterministic-opportunity-scoring.md).

ADR 0006 set the Opportunity Score at 40% opportunity severity, 25% evidence confidence, 15%
contactability, 10% local decision-making likelihood and 10% apparent commercial value, with 60 as
the qualification threshold. Now that website inspection captures pages, those weights can be tested
against real evidence rather than argued about. This ADR started as a proposal to reweight them. The
measurements say reweighting is the wrong lever, so it records that instead.

## Most of the score is a constant

Across all 202 scores this workspace has ever produced:

- `contact_component` is **15 in every single score**. It has never taken another value, because
  `qualifiesOpportunityScore` already requires a Contact Route.
- `local_decision_component` is **10 in every single score**. Centrally controlled businesses are
  excluded upstream as `national-chain` before they are scored: 13 of 164 canonical businesses are
  `Central`, and none reached scoring.
- `confidence_component` is **24 to 25 out of 25 for every candidate with captured pages**. It is the
  mean confidence of the Supporting Observations, which measures how sure the runtime is that it saw
  what it reports, not how large the opportunity is.

So about 49 of 100 points are awarded before anything about the website is considered, and the score
reduces to `49 + (severity / 5) × 40 + apparentCommercialValue × 10`. Two inputs vary, and one of
them is an integer from 1 to 5.

## Reweighting cannot change the ranking

Because only those two inputs vary, any reweighting is a monotone rescale. Scored against the eight
candidates with captured pages, ranked against a defect burden computed only from the deterministic
measurements (images missing alternative text, unlabelled controls, overflow, HTTPS, first
contentful paint, console and network failures):

| Weighting | Inversions against measured burden | Ordering |
|---|---|---|
| current 40/25/15/10/10 | 10 of 27 | baseline |
| severity 65 / value 35 | 10 of 27 | identical |
| severity 75 / value 25 | 10 of 27 | identical |
| severity 85 / value 15 | 10 of 27 | identical |

Every weighting produces the same order and the same ten inversions. A weight change moves absolute
scores, and therefore which side of the threshold a candidate falls, but it cannot reorder
candidates.

Worse, the 65/35 split this ADR originally proposed would have handed the softest input more
leverage. Measured as how much of the commercial-value range it takes to outweigh one severity band:

| Weighting | One severity band | Value range | Value outweighs |
|---|---|---|---|
| current | 8.0 | 10.0 | 1.25 bands |
| 65 / 35 | 13.0 | 35.0 | **2.69 bands** |
| 85 / 15 | 17.0 | 15.0 | 0.88 bands |

`apparentCommercialValue` is a wholly unmeasured runtime judgement, while severity is at least tied
to cited Supporting Observations. Raising value to 35% would let the least evidenced input override
nearly three severity bands. If leverage moves at all it should move the other way.

## The ranking is set by severity assignment, not by weights

Splitting the same eight candidates by the prompt version that assessed them shows where the
inversions come from:

| Prompt | Business | Unlabelled controls | Images missing alt | Severity |
|---|---|---|---|---|
| v4 | Auto-Serwis Marek Kin | 9 | 2 | 3 |
| v4 | Katarzyna Myśliwiec | 5 | 0 | 3 |
| v4 | Auto Tytan Rumia | 0 | 0 | 2 |
| v3 | Astodent | 4 | 0 | 3 |
| v3 | Jimmy Serwis | 1 | 4 | 3 |
| v3 | Rumia Motors | **11** | 0 | **2** |
| v3 | DIAMOND Auto Serwis | **13** | 0 | **2** |
| v3 | F.H.U SAMLI | 0 | 0 | 2 |

Under `website-assessment-v4` severity tracks the measurements: defects present score 3, no measured
defect scores 2. Under v3 a site with thirteen unlabelled controls scored 2 while one with four
scored 3. The inversions are concentrated in the candidates assessed before v4 required every
measurement to be accounted for. That prompt change, not a weight change, is what moved ranking
quality.

## A severity floor reproduces the whole effect

The only decision the reweighting would have changed is qualification, and adding a minimum severity
to the existing rubric reproduces it. Over all 130 current scores:

- current rubric, threshold 60: **116** qualify
- severity 65 / value 35, threshold 60: **113** qualify
- current rubric plus a minimum severity of 3: **114** qualify

The proposal and the floor disagree about **one** candidate out of 130. A two-line gate achieves what
a rubric overhaul would.

## Decision

**Do not reweight.** Keep ADR 0006's weights.

Do not adopt a severity floor yet either. Five of the eight severity values available to calibrate it
were produced by the prompt that has since been corrected, and two of those five are the clear
mis-assignments above. Choosing the floor from that data would fit it to a fixed bug. Reassess the
candidates under `website-assessment-v4` first, then choose the floor from severities the current
prompt produced.

## Consequences

- The score keeps 49 points that carry no information, so a reader cannot interpret the number: 60
  does not mean "somewhat promising", it means "49 free plus 11 earned". Removing the constant
  components and rescaling severity and value to fill the space, at 80/20, preserves today's ordering
  among observed candidates and today's leverage exactly (1.25 bands), and would make the number
  honest without changing a single decision. That is a presentation change masquerading as a rubric
  change, and it is worth doing separately and deliberately.
- Removing the confidence component would also stop penalising a blocked inspection twice, since the
  blocked policy already caps severity at 4. That interacts with the blocked-inspection limits and
  should be decided with them, not incidentally.
- Severity remains an integer from 1 to 5 carrying 40 points, so it moves in 8-point steps and cannot
  separate five unlabelled controls from nine plus 404 errors. Neither this ADR nor any reweighting
  addresses that. If finer discrimination is wanted, severity has to stop being an integer, or the
  runtime has to be given a rubric for choosing within the range.

## Alternative considered

Adding an evidence-strength component, scoring a Complete inspection above a Partial one, was
rejected. `Partial` conflates a one-page site where there was no second page to visit with an
inspection that failed to reach one. DIAMOND Auto Serwis is a genuine one-page site, and penalising
it for pages it does not have would repeat the mistake this work set out to correct.
