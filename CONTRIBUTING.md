# Contributing

Thanks for looking. This is a small, opinionated project, so a short read now saves a long review
later.

## Before You Write Code

Read [`AGENTS.md`](AGENTS.md). It is the single instruction file for this repository. `CLAUDE.md`
imports it and Codex reads it directly, and it holds the design rules and engineering guards that a
review will be measured against. Then read [`docs/Domain-Language.md`](docs/Domain-Language.md) for the domain language: this
project names things deliberately, and a pull request that calls a Candidate Business a "lead" will
be asked to rename it.

If a change contradicts an [architecture decision](docs/adr), say so in the pull request rather than
routing around it. ADRs are changeable; silently overriding one is not.

## Getting Set Up

```powershell
pnpm install
pnpm run setup
pnpm dev
```

You need Node.js 22 or newer and pnpm 10.32.1. `pnpm run setup` is safe to re-run. To exercise a
real prospecting run you also need a ready Claude, Codex, or OpenCode runtime. See the
[README](README.md#requirements).

## Before You Open A Pull Request

```powershell
pnpm check          # Biome, feature boundaries, TypeScript, unit tests, production build
pnpm test:e2e       # Chromium desktop and mobile flows
```

`pnpm check` is the gate; CI runs the same command. Lefthook already runs Biome on staged files
before a commit and typecheck plus unit tests before a push, so most problems surface early.

A few things that reliably come up in review:

- **Unit tests live beside the code they test**, as `*.test.ts` or `*.test.tsx`. Only cross-feature
  browser flows belong in `tests/e2e`.
- **Presentation logic that a reader could misread**, such as a score, a range, a relative time, or a
  status label, belongs in a `*-presentation.ts` function with tests, not inline in JSX.
- **A client component imports from `@/features/x/client`**, never `@/features/x`. The feature index
  exports server work and will drag `better-sqlite3` into the browser bundle.
- **Icons come from `@/components/icon`**, backed by Hugeicons. There is one icon set.
- **Do not start, stop, or take port 4310.** Playwright attaches to whatever is already there.

## Commits And Pull Requests

Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`,
`perf:`, `test:`), optionally scoped by feature, for example `fix(run-execution): ...`. Write the subject as
what the change does for a reader, not as a description of the diff.

Keep a pull request to one coherent change, describe what you verified, and paste the output if
something is still failing. An honest "e2e passes, `live-run` skipped locally" is more useful than
silence.

## Reporting Something

Open an issue with what you expected, what happened, your OS, Node version, and which runtime you
had selected. If it involves a run, the Technical Run Log on the run detail page is the right place
to copy from. It is factual, and it contains no model reasoning.

For anything with a security dimension, such as a way to make the inspector reach a private network, a path
where source content becomes an instruction, or a place where provider credentials could leak, please
use GitHub's private vulnerability reporting on this repository instead of a public issue.
