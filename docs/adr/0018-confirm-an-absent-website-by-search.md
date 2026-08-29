# Confirm An Absent Website By Search, But Only That

Status: Accepted

Narrows [ADR 0013](0013-search-then-structure.md) and completes
[ADR 0017](0017-corroborate-an-absent-website.md).

ADR 0013 removed per-business search from corroboration on cost: "Corroborating a business meant two
more searches for each one, so 97 businesses cost roughly 200 search calls." That was right as a
blanket rule and wrong for one claim.

ADR 0017 capped an absent website that no second page corroborated, because 25 of 31 top leads rested
on a single directory listing. Capping states the doubt honestly but never resolves it: a business
that really has no website, which is the best candidate this product can find, stays demoted for a
limitation of the search that found it.

## Only one claim is worth a search

Sampled by hand, of three businesses reported as having no website from a single listing, two were
genuinely without one and the third had `mototeam.torun.pl`. About one such claim in three is wrong,
while carrying the highest score the rubric awards.

No other claim needs this. A business **with** a website is already verified first-hand: the
application opens the site in a real browser under [ADR 0004](0004-application-owned-browser-inspection.md)
rather than trusting a description of it. Of 38 single-source businesses in one workspace, 30 had
their websites inspected directly, and the source count told the reader nothing they did not already
have. Only the 2 claiming absence were both consequential and unverified.

## Decision

A `ConfirmAbsentWebsite` stage runs between inspection and assessment, and only when an inspection
returns `NoWebsite`.

- **It spends nothing when the business already carries two or more public pages**, or when a
  confirmation already ran for it. The task still runs and records why, so the decision is visible in
  the Technical Run Log rather than invisible in a condition.
- Otherwise it searches for that one business by name and locality, reusing the discovery runtime and
  the same report-then-structure path, so the search is bounded and verified by the rules already in
  place.
- **A website it finds is inspected, not scored as absent.** The business returns to
  `InspectWebsite` with the address, carrying a marker so a second absence cannot loop.
- **An absence it confirms is recorded as presences**, the pages the search read, so corroboration
  reaches two and ADR 0017's cap lifts on evidence rather than on assumption.
- **The business is matched by name in the returned report.** The search answers about a market, so
  taking the first entry would hand a neighbour's website to whoever was being confirmed. This was
  written that way first and caught by an existing pipeline test, which lost a candidate.

## Cost

This reintroduces per-business search, which ADR 0013 removed, for a strict subset. In the workspace
measured, 2 of 78 businesses would search, against ADR 0013's two searches for every business. That
is about 2.5 per cent of the cost that decision rejected, spent only where a wrong answer would put
a business at the top of the queue.

## Consequences

- A market where discovery reports many businesses as having no website pays proportionally more.
  That is the market where the claim is least believable, so the spend follows the doubt.
- The confirming search is a second opinion from the same runtime, not an independent one. It reads
  different pages, which is what corroboration means here, but a runtime that is systematically wrong
  about a business will be wrong twice.
- Recording the confirmation as presences means a confirmed absence is corroborated for every later
  run, so the cost is paid once per business rather than once per run.
- Reading more pages per business, which
  [`discovery-report-v3`](../../CHANGELOG.md) asks for, made the same telephone arrive from two pages
  and violate the unique index on contact routes. Four businesses of ten were lost to it in one run
  before the insert deduplicated by type and value. The lesson is that asking for more evidence
  exercises paths that thinner evidence never reached.
