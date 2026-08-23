# Protect Client Entry And Split Run Storage

Status: resolved

## Problem

Feature client entry points are a critical browser-bundle boundary but the architecture checker does
not protect them. Workspace run deletion and its preview remain mixed into backup/restore storage.

## Acceptance Criteria

- [x] Client entry points cannot value-import or re-export server, infrastructure, Node, or
      runtime-adapter modules; erased type-only contracts remain allowed.
- [x] The rule has representative allowed and rejected tests.
- [x] Run deletion and deletion-preview persistence move to a cohesive module while the existing
      workspace-store interface remains compatible.
- [x] Existing tests pass unchanged.
- [x] `pnpm check` passes.

## Answer

Protected every feature `client.ts` entry against browser-unsafe value exports while explicitly
allowing erased type-only contracts. Added allowed and rejected architecture fixtures. Extracted
run deletion and its preview to `workspace-run-store.ts`, and centralized safe run-artifact path
resolution and recoverable removal in `workspace-artifacts.ts`. The existing workspace-store module
continues to re-export the same interface.

Verification: `pnpm check` passed Biome, architecture checks, TypeScript, all 336 unit tests, and the
warning-free production build.
