# Qualify On A Blocked Visitor, Not On A Defect

Status: Accepted

Amends [ADR 0006](0006-deterministic-opportunity-scoring.md) and
[ADR 0014](0014-score-measured-defects-not-confidence.md).

ADR 0006 set the qualification threshold at 60 of 100, and ADR 0014 kept it there while replacing
evidence confidence with measured defects. Neither was tested against a market the rubric had not
been tuned on. Three were run, and the threshold turned out to decide nothing.

## Three markets produced no rejection at all

The workspace was reset and four markets were run, five targets each: car repair garages in Rumia,
which is the market every earlier calibration used, then hairdressers and beauty salons in Rumia,
bakeries and cake shops in Słupsk, and dental clinics in Koszalin.

The three new markets produced **26 candidates and 26 qualified**. Dental clinics, chosen because
the trade usually has serviceable websites and should therefore produce rejections, returned eight
of eight.

Across all 53 scores the workspace has produced:

| Severity | Businesses | Qualified | Score range |
|---|---|---|---|
| 2 | 3 | 0 | 54.5 to 54.8 |
| 3 | 35 | 35 | 65.5 to 71.0 |
| 4 | 8 | 8 | 74.0 to 80.5 |
| 5 | 7 | 7 | 95.0 to 98.0 |

## Severity 3 could not fail, and severity 3 is nearly everything

The arithmetic leaves no room. Severity 3 contributes 33 of the 55 points severity carries.
Contactability and local decision-making contribute 15 and 10 to every candidate, because
qualification already requires a contact route and centrally controlled businesses are excluded
upstream. Apparent commercial value has never been observed below 6.5. That is **64.5 before a
single measured defect is counted**, against a threshold of 60.

So qualification was never a threshold. It was the test "severity is at least 3", decided entirely
by the runtime.

That would be tolerable if severity 3 were selective. It is not. The band is defined as an
accessibility or layout defect on a page a visitor can still complete, which is close to universal.
The dental clinics show what it buys:

| Business | Score | What was found |
|---|---|---|
| Stomatologia DentaLoft | 70.3 | 11 unlabelled controls, one image missing alternative text, a cookie dialog over part of the first screen |
| La Dentica | 68.4 | horizontal overflow on the mobile home and contact pages |
| Katarzyna Myśliwiec | 68.3 | a cookie dialog covering much of the first screen |
| Cliniq Stomatologia | 77.2 | no telephone, enquiry or booking action anywhere on the first screen |

The first three are accurate observations and poor reasons for a business to commission a new
website. Every site has a cookie banner and some unlabelled controls. The fourth is a real
opportunity, and it is the only one the runtime rated 4.

## The threshold sat in an empty band

No score has ever landed between 55 and 65. Moving the threshold anywhere inside that range changes
nothing, which is why 60 and 65 qualify the same 50 businesses.

| Threshold | Qualified of 53 |
|---|---|
| 60 (previous) | 50 |
| 65 | 50 |
| **72** | **15** |
| 74 | 15 |

## Decision

**Raise the qualification threshold to 72**, between the severity 3 band that ends at 71.0 and the
severity 4 band that begins at 74.0. Persisted as rubric `opportunity-score-v5`.

Qualification now means what the product is looking for: a visitor who arrived and cannot act, or a
business with no website at all. A site whose only faults are a consent dialog and some unlabelled
controls no longer reads as a lead.

Nothing else changes. The weights, the components and the severity anchoring are untouched, because
[ADR 0014](0014-score-measured-defects-not-confidence.md) established that reweighting is a monotone
rescale that reorders nothing. This moves where the line is drawn through an ordering that is
already correct.

## Consequences

- **Qualification is effectively severity 4 or higher.** That is honest rather than hidden: the
  score has no inversions, so it was always a severity classifier, and the line is now drawn at the
  band that means the visitor is blocked rather than merely inconvenienced. It also means the
  runtime's severity rating carries the entire decision, which is the thing to watch.
- **The queue holds roughly a quarter of what it did**, 15 of 53 rather than 50. For a product whose
  premise is that most local businesses do not need a new website, a gate that said yes to 94 per
  cent of them was not filtering.
- **Existing scores keep the totals they recorded.** Their qualification is re-evaluated against the
  new threshold from those unchanged totals, because a queue that still showed the old line would
  repeat the staleness this workspace was reset to clear. No component, assessment or observation is
  rewritten.
- The evaluation fixtures were retuned. `threshold-at` and `threshold-below` again straddle the line
  by design, at 72 and 71, and the per-class fixtures now describe a severity 4 opportunity so that
  a representative example of each class still clears the bar it is meant to clear.
- A business the runtime rates 3 is no longer surfaced at all, so a genuine opportunity the runtime
  underrates is now lost rather than merely ranked low. The severity anchoring in the assessment
  prompt is what protects against that, and it is the first thing to revisit if the queue looks
  empty rather than selective.
