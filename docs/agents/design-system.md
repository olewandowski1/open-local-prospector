# Design rules

How this workspace looks and behaves. These are settled decisions — follow them without asking, and
treat a deviation as a bug. Where a rule has a reason attached, the reason is the part that stops the
mistake being made again.

## Words

- **Title Case every label**: buttons, headings, field labels, column headers, tabs, badges, menu
  items, `aria-label`s. Sentences and descriptions stay sentence case.
- **Never show raw data.** No UUIDs (shorten to `#8chars`, full value in `title`), no raw floats
  (round — `24.666666666666668` is a bug), no PascalCase identifiers (space them), no ISO timestamps.
- **Statuses are one or two words.** Persisted states read as sentences; shorten them for the badge
  and keep the recorded wording in `title` so nothing is lost. See `runStatusPresentation`.
- **Echo, never invent.** When a tool or CLI reports something, show its words. Do not synthesise a
  friendlier message, and never claim a state you have not verified.
- **Providers are "Codex" and "Claude"**, not "Codex CLI" or "Claude Code". Models are short:
  `Sonnet 5`, `GPT-5.6 Sol`.
- Say what is being held back. A bounded list states its bound rather than reading as complete.

## Colour

- **Monotone.** Neutral surfaces, muted text. Colour is reserved for status and the primary action.
- **Dark mode is a ladder of surfaces**, darkest first: `--sidebar` → `--background` → `--card` →
  `--popover` → `--muted`. A raised surface is lighter than the one it sits on. Light mode keeps the
  same order.
- **Sidebar hover and active states are translucent** (`--sidebar-accent` carries an alpha), so the
  sidebar gradient shows through instead of being covered by a solid block.
- **Semantic variants exist on Button and Badge**: `success`, `warning`, `info`, `destructive`.
  Semantic badges carry an accent border, not a bare tint.
- **A status earns its colour from what it means**, not from where it sits:
  - `destructive` — a settled failure, or an outcome that stopped short of its goal.
  - `warning` — recoverable or blocked work that may yet succeed; a paused run.
  - `success` — finished well, qualified, connected.
  - `secondary` — a real outcome that simply did not make the cut. Not alarming.
  - `outline` — neutral, in flight, or the state everything starts in.
- Full-height side panels take the page background, not a raised popover surface.

## Layout

- **No cards around tables or page sections.** Structure comes from headings, rules and spacing.
  Cards are for genuinely card-shaped things, like one run in a grid of runs.
- **Page content is capped and centred** (`max-w-5xl`); the breadcrumb stays left in the header.
- **Do not force the reader to scroll.** Bound a page to the viewport
  (`h-[calc(100svh-var(--shell-header))]`) and let its panes scroll internally.
- **No horizontal overscroll.** Tables drop columns as they narrow, in ascending order of usefulness.
- **Use container queries (`@container`, `@md:`, `@2xl:`) for that, not viewport breakpoints.** The
  sidebar appears at `md`, which makes the content area *narrower* at 768px than at 640px. A viewport
  breakpoint cannot express that; a container query can.
- **A truncating column needs an explicit width**, not a maximum — automatic table layout is free to
  overrule a maximum.
- **`truncate` belongs on the text element.** A flex row cannot truncate its children.
- **A flex child needs `min-w-0`** to shrink below its content; without it, it pushes the page wider
  than the viewport.
- Generous gaps between page sections (`gap-8`); tight gaps within a group.

## Components

- **Use the installed shadcn primitives.** Check `src/components/ui/` before writing markup, and
  compose rather than restyle. This project is on `base-ui`, so custom triggers use `render`, not
  `asChild`.
- **Adding a primitive may overwrite a customised one.** `shadcn add` wants to rewrite `button.tsx`;
  diff first and restore local variants after.
- **Overlays**: `Dialog` to decide something, `Sheet` for a full record beside the list it came from,
  `AlertDialog` to confirm something irreversible.
- **Empty states use `Empty`** and offer the action that resolves them.
- **Every icon-only control has a tooltip.** Use `IconButton`, or `IconLink` when it navigates. One
  `label` feeds both the accessible name and the tooltip so they cannot drift.
- **Navigation renders an anchor.** A `Button` with `nativeButton={false}` stamps `role="button"` on
  a link, which announces navigation as a button.
- **One pager for every table**: `DataTablePagination`, built on shadcn `Pagination`, default page
  size 25. Tables are TanStack v9 (`useTable`, `tableFeatures`) with sorting, pagination and an
  actions column.
- **Badges are for statuses.** A fact is plain text. Reaching for a badge to style a value is the
  usual way a page ends up looking noisy.
- **Selects open below their trigger** (`alignItemWithTrigger={false}` is the default here) rather
  than over the field being changed.
- **`DialogFooter layout="stretch"`** when the primary action should fill the row.
- Toasts (`sonner`) for actions that would otherwise leave no trace, such as recording a decision.

## Engineering guards

- **A client component imports from `@/features/x/client`, never `@/features/x`.** The feature index
  exports server work, and a value import drags `better-sqlite3` and `node:child_process` into the
  browser bundle. Turbopack fails with a chunking-context panic.
- **Pure presentation logic lives in `*-presentation.ts` with unit tests.** Anything a reader could
  misread — a score, a range, a relative time, a status label — is a tested function, not inline JSX.
- **A write that replaces every column it is given needs the untouched values sent back.** Omitting
  them silently erases data. See `updateCandidateReview`.
- **Reset state by remounting with `key`**, not with an effect watching the selection.
- **Bound anything unbounded.** Fixed subprocess arguments, explicit timeouts, capped output,
  virtualized long lists.

## Tests

- **Never assume a wide viewport.** Columns hide as the container narrows, so assert on a column
  that is always present, or navigate the way a reader would at that width.
- **The developer owns the dev server on `127.0.0.1:4310`.** Playwright attaches to it
  (`reuseExistingServer: true`). Do not start, stop or take the port.
- One dev server serves every worker, so a click or hover landing before hydration is a genuine
  no-op. Where a retry is needed, make it idempotent so it cannot mask a regression.
