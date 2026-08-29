# Corroborate An Absent Website Before Scoring It In Full

Status: Accepted

Amends [ADR 0014](0014-score-measured-defects-not-confidence.md).

ADR 0014 gave a business with no website the observed-defect component in full, on the grounds that
this is "knowledge of absence, not absence of knowledge: there is no worse state for a website than
not existing, and the inspection records `NoWebsite` from confirmed public presence rather than
assuming it". The runtime rates those businesses severity 5, so they score 95 to 98.5 and occupy the
top of the queue.

Run across fourteen cities, the premise turned out not to hold. `NoWebsite` is being recorded from a
single directory listing that simply did not mention a website.

## The strongest leads rest on the least evidence

Car repair garages were run in four cities. The qualification rate ranged from 11 per cent in
Wrocław to 100 per cent in Toruń, which looked like the rubric reading the town rather than the
trade. It was not. Toruń returned **nine businesses of nine as `NoWebsite`**, and Wrocław returned
none.

The Toruń report explains itself. Almost every business was read from one directory page,
`pewnyfachowiec.pl/elektryk-samochodowy-torun/`, and against each the runtime wrote *"Własna strona:
nie znalazłem"*, meaning "own website: I did not find one". That is an honest report of what one
page showed. It is not the same claim as the business having no website, and nine independent
garages in a city of 200,000 having none is not credible.

Across the whole workspace, of 32 businesses scored `NoWebsite`:

| Distinct pages read about the business | Businesses |
|---|---|
| 0 | 1 |
| 1 | 25 |
| 2 | 4 |
| 3 | 2 |

**25 of the 31 leads scoring 95 or above rest on a single page.** The tool's strongest
recommendations are its least verified ones, which is the wrong way round.

## Decision

An absent website is scored in full only when more than one public page evidences the business.

- **A `NoWebsite` inspection corroborated by fewer than two distinct public pages caps severity at
  4**, the same ceiling a blocked inspection already carries, under its own name
  `UNCORROBORATED_ABSENCE_MAX_SEVERITY` because the reason differs. A blocked inspection was
  prevented from seeing; an uncorroborated absence was never really looked for.
- The observed-defect component stays at full for `NoWebsite`. If the business does have no website
  then nothing about that is softened, and the severity cap alone expresses the doubt.
- Corroboration counts distinct public pages recorded for the Canonical Business, so evidence
  accumulates across runs. A business seen once today and again next week on another page earns the
  full score then, without reassessment.
- Persisted as rubric `opportunity-score-v6`.

## What it does to the real workspace

| State | Score now | Score under this rule |
|---|---|---|
| No website, one page (25 businesses) | 95.0 to 98.5 | about 86 |
| No website, two or more pages (6) | 96.5 to 98.0 | unchanged |

The resulting order says what the evidence supports:

1. **96.5 to 98** a website that is confirmed absent
2. **about 86** a website that is probably absent, seen on one page
3. **74 to 80.8** a visitor who arrived and cannot act
4. **64 to 72** a defect the visitor can work around, which does not qualify

An uncorroborated absence still qualifies, and still outranks a site whose first screen offers no
way to act, which is right: it is a strong lead, just not a confirmed one.

## Consequences

- Most `NoWebsite` businesses are capped today, 25 of 32, because discovery usually reads one
  directory page per business. That is a fair description of the evidence, not a penalty, and the
  cap lifts by itself as a business is seen again.
- The deeper cause is upstream and is not addressed here: discovery sometimes reads a single listing
  page for an entire market, which is also what produced the report that named one source for every
  business and lost twelve of them to the co-location rule. Reading more pages per business would
  improve identity, contacts and this at once, and it is the change worth making next.
- Qualification rates by trade will move, and the earlier claim that the rubric reads the trade
  rather than the town should be treated as unproven. It was drawn from two towns and did not
  survive four.
- A business genuinely absent from the web, which is the ideal candidate this product exists to
  find, is now ranked below a business seen twice. That is deliberate. Ranking on evidence is worth
  more than ranking on a single unverified claim, and the second sighting is cheap to obtain.
