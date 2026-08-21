# Delete one business

Status: implemented, ticket written after the fact

Ticket 04 deletes a whole run. Sometimes the thing that should not be stored is one business: a
record built from a directory page rather than a business, or one whose evidence turned out to be
about somebody else. Deleting the run that found it throws away everything else the run learned.

This was built alongside tickets 01–07 without a ticket of its own. It is recorded here so the
behaviour is specified rather than inferred from the code.

## What it does

From the candidate panel in the Review Queue, removes one canonical business: its run associations,
its discovered inputs, its tasks, and its inspection artifacts.

## Deleting is not Do Not Contact

The first implementation wrote a Suppression Entry reasoned "Deleted by operator", so the business
appeared under Suppressed Businesses as though the operator had asked never to contact it, and could
never be discovered again. `CONTEXT.md` reserves a Suppression Entry for that deliberate standing
instruction, and lists "deleted lead" under *Avoid*.

Deleting is about stored data. It leaves no record, so a later run may find the business again, and
the panel says so. An operator who wants it kept out for good has Suppress, which is the action that
means that.

## Acceptance

- [x] Refuses while a run is not in a terminal state.
- [x] Requires the operator to type DELETE.
- [x] Removes the canonical business, its run associations, discovered inputs, tasks and artifacts.
- [x] Writes no Suppression Entry, and the panel states that a later run may find the business again.
- [x] Reports artifact files that could not be removed rather than reporting a clean delete.
- [x] Covered by `workspace-store.test.ts` ("deletes a business without recording it as Do Not
      Contact").

## Comments

Raised by a review of the change against this feature's spec, together with the suppression
semantics, which were corrected at the same time.
