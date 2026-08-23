# Narrow Feature Interfaces

Status: resolved

## Acceptance Criteria

- [x] Browser, server, and worker consumers use purpose-specific feature entry points.
- [x] General feature indexes no longer expose unnecessary concrete adapters.
- [x] Architecture and worker composition checks pass.

## Answer

Added dedicated worker entry points for discovery, identity, scoring, assessment, inspection, and
runtime execution. The worker composition root now uses only those surfaces; general indexes no
longer export worker-only adapters. Added an architecture rule reserving worker surfaces for the
worker root. Architecture, TypeScript, and `pnpm worker:check` pass.
