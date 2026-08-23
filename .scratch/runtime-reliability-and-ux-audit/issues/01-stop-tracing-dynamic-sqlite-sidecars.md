# Stop Tracing Dynamic SQLite Sidecars

Status: resolved

The production build warns that checking a dynamically named SQLite sidecar causes Turbopack to
trace the whole project into server output.

## Acceptance

- [x] SQLite checkpoint cleanup still removes the explicit `-wal` and `-shm` sidecars safely.
- [x] The production build no longer reports dynamic filesystem tracing from `workspace-store.ts`.
- [x] Workspace administration tests and the full project check pass.

## Answer

Replaced the check-then-unlink sequence with `rmSync(sidecar, { force: true })`. The cleanup remains
bounded to the database's two explicit SQLite sidecar paths, handles an already absent file without
a race, and no longer asks Turbopack to trace a dynamic `existsSync` access.

Verification:

- `pnpm vitest run src/features/workspace-administration/infrastructure/workspace-store.test.ts` —
  10 tests passed.
- `pnpm check` — Biome, architecture, typecheck, 330 tests, and a warning-free production build
  passed.
