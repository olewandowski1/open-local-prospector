# Strengthen Boundaries And Workspace Storage

Status: resolved

## Problem

The feature-boundary check scans imports with a regular expression and does not enforce all layer
directions. Workspace administration also concentrates unrelated backup, restore, inventory,
cleanup, suppression, and run-deletion behavior in one infrastructure file.

## Acceptance Criteria

- [x] Architecture checks reject same-feature inward dependency violations as well as cross-feature
      internal imports.
- [x] Architecture checks cover re-exports, dynamic imports, and representative allowed imports.
- [x] Workspace storage responsibilities are split into cohesive infrastructure modules without
      changing the feature's public interface.
- [x] Existing workspace storage tests continue to pass without weakening assertions.
- [x] `pnpm check` passes.

## Answer

Added enforceable same-feature layer direction rules, including coverage for ordinary imports,
re-exports, dynamic imports, and Next.js Server Component composition. Moved the Suppression Record
contract out of persistence and into the feature domain. Extracted shared workspace database setup
and table-classification safety checks into `workspace-database.ts`, and extracted inventory and
Suppression Entry reads/writes into `workspace-read-store.ts`; `workspace-store.ts` remains a
compatibility facade for its existing consumers.

Verification:

- `pnpm check` passed: Biome, architecture, TypeScript, 333 unit tests, and production build.
- A subsequent `pnpm build` passed without the dynamic filesystem tracing warning after explicitly
  marking the runtime-configured SQLite sidecar check as excluded from Turbopack tracing.
