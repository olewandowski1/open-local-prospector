# Resolve Identity By Any Shared Route, Not One Computed Key

Status: Proposed

Amends [ADR 0013](0013-search-then-structure.md).

ADR 0013 kept identity resolution deterministic: a canonical fingerprint, computed by application
code, deduplicating businesses across runs. That was right, and the fingerprint is still the
mechanism. What it got wrong is that the fingerprint is a *single* key, chosen by priority from
whatever a run happened to capture, and then matched by exact equality. A business observed twice,
slightly differently, becomes two businesses.

## A third of a new workspace was duplicated

The workspace was reset and three runs of one market, Rumia car repair garages, five targets each,
were run back to back. They produced **20 canonical records for 15 real businesses**. Five pairs
were the same business twice, and three of those pairs reached the review queue.

The fingerprint is built by taking the first available of: a telephone, the website host, a
non-telephone contact, then the name and locality. Three separate ways of forking follow from that.

**The telephone chosen depends on the order they were listed.** Auto Tytan has two numbers:

| Record | Fingerprint | Website | Telephones held |
|---|---|---|---|
| AUTO TYTAN | `tel:48602764645` | autotytan.pl | 602 764 645 |
| Auto Tytan Rumia | `tel:48604421023` | autotytan.pl | 604 421 023, 602 764 645 |

Both describe the same garage, on the same website, and they even share a telephone number. They
forked because `contacts.find` takes the first telephone, and the two runs listed the numbers in a
different order.

**The country code is not normalised.** The number the two records share is written `48602764645`
in one fingerprint and would be `602764645` from the other, so even a shared number does not
guarantee a shared key.

**The strategy differs with what was captured.** Jimmy Serwis is `tel:882422841` in one record and
`web:jimmyserwis pl` in the other, though both hold the site `jimmyserwis.pl` and the address
`kontakt@jimmyserwis.pl`. PETA Auto Remont is `tel:600085786` against `web:petaserwis pl`, sharing
`petaserwis.pl`. A run that captured no telephone can never key the same way as one that did.

A fourth way, telephone values differing only in formatting, was fixed separately by comparing
digits rather than words. That merged nine pairs in the previous workspace, including
`tel:tel 59 842 82 91` against `tel:59 842 82 91` and `509 180 099` against `509 18 00 99`. It does
not address any of the three above.

## What the duplication costs

It is not only a repeated row. Reassessment re-runs identity resolution, so reassessing a business
resolves to whichever record the fresh observation keys to, and writes the new score there. In the
previous workspace an inflated score of 95.8, computed from an inspection that saw nothing, sat at
rank 7 of the queue and could not be refreshed: every attempt to reassess it produced a correct
score of 68.8 on the *other* record, and left the 95.8 in place. Four businesses were in that state.

## Decision

Resolve a business against the routes it carries, rather than against one key computed from them.

- On corroboration, look for an existing Canonical Business sharing **any** of: a telephone
  subscriber number, a website host, or an email address. Create a record only when nothing matches.
- **Compare telephones as subscriber numbers**, digits only, with a leading country calling code
  removed, so `+48 602 764 645`, `48602764645` and `602 764 645` are one number.
- **Compare website hosts without `www.`**, as `websiteHost` already does.
- The stored fingerprint stays, as the record's primary key and as what suppression entries
  reference. It is now the strongest route the business is known by rather than the only one it can
  be found by.
- **Stored fingerprints must be migrated with the change.** Identity is looked up by exact
  fingerprint equality, so altering how one is computed without rewriting the stored values makes a
  known business unmatchable and creates a third record rather than merging two. This was verified
  before shipping the digits change.

## What it does to the real workspace

Modelled against the 20 records the three fresh runs produced, the rule yields **17 clusters**,
merging exactly three pairs and nothing else:

| Merged | Shared evidence |
|---|---|
| AUTO TYTAN, Auto Tytan Rumia | telephone 602764645 and host autotytan.pl |
| Jimmy Serwis, Jimmy Serwis | kontakt@jimmyserwis.pl and host jimmyserwis.pl |
| PETA AUTO REMONT, PETA AUTO REMONT | host petaserwis.pl |

Those three are precisely the duplicates that reached the queue, so the rule removes all of the
duplication a reader would see, and no two businesses are joined without a route they share.

## What it deliberately does not do

The other two pairs are not merged, and should not be. `AUTO SERWIS - Marek Kranczkowski` and
`Auto Serwis Alldecar` each exist twice, once keyed by telephone and once by `name:` alone. The
`name:` records hold no contact route and no website, which is both why they fell back to a name and
why they are already excluded as `missing-contact` and never scored. Nothing links them to their
twin except the name.

Matching those would mean comparing names, which ADR 0013 removed for good reason:
`wordSimilarity("Salon fryzjerski Justyna", "Salon fryzjerski Bellezza")` is 0.67, because a trade
category is not a name. Note that the case here is narrower, testing a weak observation against a
known business in the same locality rather than two arbitrary search results, so it may be
answerable later. It is deferred rather than rejected, and it costs nothing today because those
records never reach the queue.

## Consequences

- Resolution becomes a lookup over several keys instead of one, so it needs an index over contact
  routes and website presences rather than the single unique index on the fingerprint.
- A business that legitimately shares a route with another, such as two outlets behind one
  switchboard, would merge. This is the same trade the fingerprint already makes by keying on a
  telephone at all, and ADR 0013's rule that stable public routes outrank names still holds.
- Merging existing duplicates is a separate data migration. Ten records in the previous workspace
  were merged by hand under this rule, keeping the newest-scored record and repointing the seven
  tables that reference a Canonical Business, which is the shape the migration would take.
- Contact contamination raises the stakes. While a contact could be attributed from a neighbour's
  page, matching on any shared route could have merged two genuinely different businesses. That
  defect is fixed, and this change should not land before it.
