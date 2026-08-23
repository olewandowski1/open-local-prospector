# Search First, Structure Second

Status: Accepted

Amends [ADR 0012](0012-use-subscription-runtime-web-search.md).

Discovery asked the runtime to search the web and answer in a closed JSON schema in one step. The
schema it had to satisfy while searching was `{ title, url, description }[]`: a search-results page,
not a finding. Every judgement that turns results into businesses was therefore left to application
code, which had no language model available and did it with string similarity and regular
expressions.

That did not work, and could not. `wordSimilarity("Salon fryzjerski Justyna", "Salon fryzjerski
Bellezza")` is 0.67, because two words of three match: the heuristic cannot tell a trade category
from a name. Raising the threshold loses "Gabinet Uśmiech" against "Gabinet Uśmiech Kraków". In a
real run of six Polish towns, 18 of 66 distinct contact routes were attached to more than one
business, one Facebook page was attached to five different salons, and a nine-digit window cut out
of a Facebook page id was presented as a telephone number.

A run now uses the runtime twice per query, in two separate calls:

1. **Search and report.** The runtime searches and writes a report of what it found: the businesses
   it believes exist, in prose, each with the exact URLs it read. No output schema, because a model
   made to satisfy a schema while driving tools spends its attention on the schema.
2. **Structure.** The runtime is given its own report and nothing else, no tools, and must answer in
   a closed schema: one entry per business, with the name, the site, the contact routes and the
   public presences that belong to *that* business, each citing the URL it came from.

Telling one business from another is the reasoning step, and it happens where the reasoning is. What
the application keeps is everything that must be true regardless of what a model says:

- A cited URL must appear verbatim in the report the model was given, and must be a public HTTP(S)
  address that passes the existing network policy. The model cannot introduce a source.
- A contact value must occur in the report text at the citation it claims, compared digit by digit
  for telephone numbers. A number nobody wrote down is not a number.
- A telephone number must exist in the numbering plan of the Search Area's country.
- Anything that fails is dropped and counted, not repaired, and never silently replaced by a
  heuristic guess.

Identity resolution keeps its deterministic half: the canonical fingerprint, deduplication across
runs, the eligibility decision, and the Opportunity Score, which [ADR
0006](0006-deterministic-opportunity-scoring.md) requires application code to calculate. What it
loses is the half that was trying to read Polish business names with a regular expression.

Reports and structured output are persisted with their prompt and schema versions, so a run can be
explained after the fact and re-run against the evaluation fixtures when either changes. Source
content stays untrusted throughout: the report is delimited evidence to the structuring call, never
instruction, and the runtime is invoked for structuring with tools disabled.

This also removes the reason a run was slow. Corroborating a business meant two more searches for
each one, so 97 businesses cost roughly 200 search calls. Businesses now arrive already separated
from the query that found them, and corroboration verifies and deduplicates rather than searching
again.
