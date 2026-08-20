# 06 — See And Undo Suppressions

**What to build:** A list of suppressed businesses, with a way to lift one.

**Blocked by:** None.

**Status:** implemented and verified

- [ ] The Data section lists every entry in `suppression_entries` with the business name, the reason
      recorded, and when it was suppressed.
- [ ] A suppression can be lifted, and the business becomes eligible for future runs again.
- [ ] Lifting one is confirmed by a toast, since it otherwise leaves no trace on screen.
- [ ] The empty state says that nothing is suppressed, and what suppressing does.

## Notes

Today suppressing is a one-way door: the review panel writes the entry, the read models filter on it
forever, and no interface shows it. That gap was widened by the new review flow, which makes
suppression easier to reach. Small ticket, closes a real hole.
