# Split Workspace Storage

Status: resolved

## Acceptance Criteria

- [x] Backup and restore live in a cohesive infrastructure module.
- [x] Reset, compaction, business deletion, and artifact cleanup are separated by responsibility.
- [x] The compatibility facade preserves existing consumers and tests.
- [x] Focused checks pass.

## Answer

Moved backup/restore into `workspace-backup-store.ts`, lifecycle maintenance into
`workspace-lifecycle-store.ts`, and retained `workspace-store.ts` as a narrow compatibility facade.
The workspace storage tests, TypeScript, Biome, and architecture checks pass.
