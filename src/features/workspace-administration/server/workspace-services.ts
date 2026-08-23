import { loadLocalApplicationConfig } from "@/features/local-application"
import { WorkspaceBusyError } from "@/features/workspace-administration/domain/workspace-errors"
import { isWorkspaceMaintenanceActive } from "@/features/workspace-administration/infrastructure/workspace-operation-lock"
import {
  cleanupArchivedArtifacts,
  compactWorkspace,
  createWorkspaceBackup,
  deleteBusiness,
  deleteRun,
  liftSuppression,
  listSuppressions,
  readRunDeletionPreview,
  readWorkspaceInventory,
  resetWorkspace,
  restoreWorkspaceBackup,
} from "@/features/workspace-administration/infrastructure/workspace-store"

export const getWorkspaceInventory = () => readWorkspaceInventory(loadLocalApplicationConfig())
export const getSuppressions = () => listSuppressions(loadLocalApplicationConfig().databasePath)
export const downloadWorkspaceBackup = () => createWorkspaceBackup(loadLocalApplicationConfig())
export const restoreWorkspace = (path: string) =>
  restoreWorkspaceBackup(loadLocalApplicationConfig(), path)
export const resetLocalWorkspace = () => resetWorkspace(loadLocalApplicationConfig())
export const compactLocalWorkspace = () => compactWorkspace(loadLocalApplicationConfig())
export const cleanupLocalArtifacts = () => cleanupArchivedArtifacts(loadLocalApplicationConfig())
export const deleteLocalBusiness = (scoreId: string) =>
  deleteBusiness(loadLocalApplicationConfig(), scoreId)
export const deleteProspectingRun = (runId: string) =>
  deleteRun(loadLocalApplicationConfig(), runId)
export const getRunDeletionPreview = (runId: string) =>
  readRunDeletionPreview(loadLocalApplicationConfig().databasePath, runId)
export const removeSuppression = (identityFingerprint: string) =>
  liftSuppression(loadLocalApplicationConfig().databasePath, identityFingerprint)
export const workspaceMaintenanceIsActive = () =>
  isWorkspaceMaintenanceActive(loadLocalApplicationConfig().databasePath)

// Never take the operation lock here: the worker holds it for the whole of every cycle.
export const withWorkspaceAdmission = <T>(work: () => T): T => {
  if (workspaceMaintenanceIsActive()) throw new Error("Workspace maintenance is in progress.")
  return work()
}

export function isLoopbackApiRequest(request: Request): boolean {
  const host = request.headers.get("host")
  if (!host) return false
  const match = /^127\.0\.0\.1(?::([1-9]\d{0,4}))?$/.exec(host)
  if (!match) return false
  return match[1] === undefined || Number(match[1]) <= 65_535
}

export function assertSameOrigin(request: Request): void {
  if (!isLoopbackApiRequest(request)) throw new Error("Local API request refused.")
  const origin = request.headers.get("origin")
  if (!origin) return
  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    throw new Error("Cross-origin request refused.")
  }
  if (
    originUrl.host !== request.headers.get("host") ||
    originUrl.origin !== origin ||
    !["http:", "https:"].includes(originUrl.protocol)
  ) {
    throw new Error("Cross-origin request refused.")
  }
}

export function workspaceErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Workspace operation failed."
  const status = error instanceof WorkspaceBusyError ? 409 : 400
  return Response.json({ error: message }, { status })
}
