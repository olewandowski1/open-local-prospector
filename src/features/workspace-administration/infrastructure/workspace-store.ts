// Compatibility surface for existing server consumers. Implementations are split by responsibility.
export {
  type BackupArtifact,
  createWorkspaceBackup,
  type RestoreResult,
  restoreWorkspaceBackup,
} from "@/features/workspace-administration/infrastructure/workspace-backup-store"
export { assertCompleteTableClassification } from "@/features/workspace-administration/infrastructure/workspace-database"
export {
  type ArtifactCleanupResult,
  cleanupArchivedArtifacts,
  compactWorkspace,
  deleteBusiness,
  resetWorkspace,
} from "@/features/workspace-administration/infrastructure/workspace-lifecycle-store"
export {
  liftSuppression,
  listSuppressions,
  readWorkspaceInventory,
} from "@/features/workspace-administration/infrastructure/workspace-read-store"
export {
  deleteRun,
  type RunDeletionPreview,
  readRunDeletionPreview,
} from "@/features/workspace-administration/infrastructure/workspace-run-store"
