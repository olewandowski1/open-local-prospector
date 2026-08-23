<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`; verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Open Prospector

A local-first application that finds independent businesses whose public online presence suggests a
website opportunity. One local user, no outreach. This file is the only instruction file: `CLAUDE.md`
imports it, and Codex reads it directly. Everything an agent must follow is here or linked from here.

## Orientation

- [`docs/Domain-Language.md`](docs/Domain-Language.md) is the domain glossary. Name concepts the way it names them; do not
  drift to synonyms it avoids.
- [`docs/adr/`](docs/adr) holds the architecture decisions. Read the ones touching the area you are
  about to change. If your work contradicts an ADR, surface the conflict rather than silently
  overriding it.
- [`docs/Product.md`](docs/Product.md) is the living product requirements.
- [`README.md`](README.md) documents the commands. `pnpm check` is the verification gate.
- [`Changelog.md`](Changelog.md) records project changes. Update its `Unreleased` section for every
  task that changes repository files. Never commit or push a change without recording it there.
- Commit and push completed in-scope changes at the end of every implementation task. Preserve and
  exclude unrelated user changes.

## Source Layout

```text
src/app/                  Next.js routes and composition
src/components/           app shell, shared components, generated shadcn primitives
src/features/<feature>/   feature-owned domain, application, infrastructure, server, presentation
src/worker/               independent worker composition root
src/test-support/         unit fixtures and e2e helpers
tests/e2e/                browser flows grouped by app, live, workspace, and docs purpose
```

A feature owns its own layers and exposes a public interface; cross-feature imports go through it.
`pnpm check:architecture` enforces this. Read `src/architecture/feature-boundaries.ts` for the exact
rules before working around one.

# Design Rules

How this workspace looks and behaves. These are settled decisions. Follow them without asking, and
treat a deviation as a bug. Where a rule has a reason attached, the reason is the part that stops the
mistake being made again.

## Words

- **Title Case every label**: buttons, headings, field labels, column headers, tabs, badges, menu
  items, `aria-label`s. Sentences and descriptions stay sentence case.
- **Do not use em dashes.** Use sentence breaks, commas, colons, or parentheses instead.
- **Never show raw data.** No UUIDs (shorten to `#8chars`, full value in `title`), no raw floats
  (round because `24.666666666666668` is a bug), no PascalCase identifiers (space them), no ISO timestamps.
- **Statuses are one or two words.** Persisted states read as sentences; shorten them for the badge
  and keep the recorded wording in `title` so nothing is lost. See `runStatusPresentation`.
- **Echo, never invent.** When a tool or CLI reports something, show its words. Do not synthesise a
  friendlier message, and never claim a state you have not verified.
- **Providers are "Codex", "Claude", and "OpenCode"**, not CLI product names. Models are short:
  `Sonnet 5`, `GPT-5.6 Sol`, `Ox Alpha Free`.
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
  - `destructive`: a settled failure, or an outcome that stopped short of its goal.
  - `warning`: recoverable or blocked work that may yet succeed; a paused run.
  - `success`: finished well, qualified, connected.
  - `secondary`: a real outcome that simply did not make the cut. Not alarming.
  - `outline`: neutral, in flight, or the state everything starts in.
- Full-height side panels take the page background, not a raised popover surface.

## Layout

- **Treat a page as a document.** The shared page scroller, one page header, and clearly titled
  sections separated by whitespace or `Separator`.
- **Prefer flat sections and responsive row groups.** A bordered container may group closely related
  rows; it must not become a card around every fact.
- **In an action row, the title and its explanatory context sit left and a normally sized action
  sits right**, stacking on narrow viewports.
- **No cards around tables or page sections.** Structure comes from headings, rules and spacing.
  Cards are for genuinely card-shaped things, like one run in a grid of runs.
- **Page content is capped and centred** (`max-w-5xl`); the breadcrumb stays left in the header.
- **Do not force the reader to scroll.** Bound a page to the viewport
  (`h-[calc(100svh-var(--shell-header))]`) and let its panes scroll internally.
- **No horizontal overscroll.** Tables drop columns as they narrow, in ascending order of usefulness.
- **Use container queries (`@container`, `@md:`, `@2xl:`) for that, not viewport breakpoints.** The
  sidebar appears at `md`, which makes the content area *narrower* at 768px than at 640px. A viewport
  breakpoint cannot express that; a container query can.
- **A truncating column needs an explicit width**, not a maximum. Automatic table layout is free to
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
- **Empty states use `Empty`** and offer the action that resolves them. One sits where the content
  it replaces would start, not centred in the viewport: `Empty` is `flex-1`, so it stretches whenever
  its parent has spare height. Keep the page column in a wrapper *inside* `PageScroller` rather than
  putting the layout classes on the scroller, whose inner element is `min-h-full`.
- **Every icon comes from `@/components/icon`.** One set (Hugeicons), one stroke weight, hidden from
  assistive technology unless given an `aria-label`. `src/components/ui/` calls `HugeiconsIcon`
  directly because that is what `shadcn add` writes and re-writes; nothing else should.
- **Every icon-only control has a tooltip.** Use `IconButton`, or `IconLink` when it navigates. One
  `label` feeds both the accessible name and the tooltip so they cannot drift.
- **Navigation renders an anchor.** A `Button` with `nativeButton={false}` stamps `role="button"` on
  a link, which announces navigation as a button.
- **One pager for every table**: `DataTablePagination`, built on shadcn `Pagination`, default page
  size 25. Tables are TanStack v9 (`useTable`, `tableFeatures`) with sorting, pagination and an
  actions column.
- **Badges are for statuses.** A fact is plain text. Reaching for a badge to style a value is the
  usual way a page ends up looking noisy. Reach for `Badge` only where its compact shape materially
  improves scanning of a categorical state in a dense collection, such as a table, list or card grid. Never
  for counts, metadata, filters, action labels, or a detail page's current state.
- **A detail page states its current state as a labeled row** with concise semantic text, not a
  badge. Ordinary facts stay neutral; `success`, `warning`, `info` and `destructive` are reserved for
  states that carry those meanings, and `outline`/`secondary` are not catch-all variants.
- **Counts are tabular text.** A count inside a button label is ordinary text, never a nested badge.
- **Button variants follow intent**: `default` for the primary forward action, `outline` for neutral
  secondary actions, `ghost` for low-emphasis utilities, `warning` for reversible interruption,
  `success` for recovery or resume, `destructive` only for the irreversible. Hide mutually exclusive
  actions that the current state does not allow instead of showing a cluster of disabled controls.
- **Selects open below their trigger** (`alignItemWithTrigger={false}` is the default here) rather
  than over the field being changed.
- **`DialogFooter layout="stretch"`** when the primary action should fill the row.
- **No toasts.** `sonner` was removed deliberately; do not reintroduce it. An action confirms itself
  by changing what is on screen. The decided row restates its status, a lifted suppression leaves
  the list. Where an action genuinely leaves nothing behind, show the outcome in place, next to the
  control that caused it, rather than in a corner the reader has to catch.

## Engineering Guards

- **A client component imports from `@/features/x/client`, never `@/features/x`.** The feature index
  exports server work, and a value import drags `better-sqlite3` and `node:child_process` into the
  browser bundle. Turbopack fails with a chunking-context panic.
- **Pure presentation logic lives in `*-presentation.ts` with unit tests.** Anything a reader could
  misread, such as a score, a range, a relative time, or a status label, is a tested function, not inline JSX.
- **A write that replaces every column it is given needs the untouched values sent back.** Omitting
  them silently erases data. See `updateCandidateReview`.
- **Reset state by remounting with `key`**, not with an effect watching the selection.
- **Bound anything unbounded.** Fixed subprocess arguments, explicit timeouts, capped output,
  virtualized long lists.

## Tests

- **Never assume a wide viewport.** Columns hide as the container narrows, so assert on a column
  that is always present, or navigate the way a reader would at that width.
- **The suite owns its own workspace, and never the developer's.** `127.0.0.1:4310` belongs to the
  developer; `pnpm test:e2e` seeds `.scratch/e2e` from `src/test-support/e2e-workspace.ts` and serves
  a production build of it on `127.0.0.1:4312`. Reading the developer's runs meant the suite passed
  or failed on data nobody had checked in, and a destructive spec could have reached real
  businesses' contact details.
  - **The fixture is synthesised, never a snapshot.** This repository is public and a real workspace
    holds real people's telephone numbers. Invent the businesses and the towns.
  - **Seeding happens inside the `webServer` command**, not in `globalSetup`: Playwright starts the
    server first, and the server opens the database as it boots.
  - **The suite serves `next build`, not `next dev`.** Turbopack compiles a route on its first
    request, and a click landing during that compile is a genuine no-op, so parallel workers raced
    hydration and failed on a healthy application.
  - **Backup, restore, reset and deletion round trips** keep their own single-worker server on
    `127.0.0.1:4311` under `tests/e2e/config/workspace.config.ts`, resolving beneath
    `.scratch/workspace-e2e`, gated by `PROSPECTOR_ISOLATED_WORKSPACE_TEST` and skipped by the
    normal `pnpm test:e2e` run.
- One server serves every worker, so a click or hover landing before hydration is a genuine no-op.
  Where a retry is needed, make it idempotent so it cannot mask a regression.
