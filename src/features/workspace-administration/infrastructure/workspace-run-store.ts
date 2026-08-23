import type { LocalApplicationConfig } from "@/features/local-application"
import { WorkspaceBusyError } from "@/features/workspace-administration/domain/workspace-errors"
import {
  removeTreeAndCountFailures,
  safeRunArtifactsPath,
} from "@/features/workspace-administration/infrastructure/workspace-artifacts"
import { openWorkspaceDatabase } from "@/features/workspace-administration/infrastructure/workspace-database"
import { withWorkspaceOperationLock } from "@/features/workspace-administration/infrastructure/workspace-operation-lock"

const TERMINAL_RUN_STATES = ["Completed", "Cancelled"] as const

export type RunDeletionPreview = Readonly<{
  discoveredBusinesses: number
  candidateBusinesses: number
  evidenceArtifacts: number
  sharedCanonicalBusinesses: number
}>

export function deleteRun(
  config: LocalApplicationConfig,
  runId: string,
): Readonly<{ leftoverFiles: number }> {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    try {
      const run = database
        .prepare("select state, search_brief from prospecting_runs where id = ?")
        .get(runId) as { state: string; search_brief: string } | undefined
      if (!run) throw new Error("Run not found.")
      if (!TERMINAL_RUN_STATES.includes(run.state as (typeof TERMINAL_RUN_STATES)[number])) {
        throw new WorkspaceBusyError(runId, runLabel(run.search_brief, runId))
      }
      database.transaction(() => {
        database.prepare("delete from prospecting_runs where id = ?").run(runId)
        database.exec(
          `delete from canonical_businesses
           where not exists (
             select 1 from run_businesses
             where run_businesses.canonical_business_id = canonical_businesses.id
           )`,
        )
      })()
    } finally {
      database.close()
    }

    const runArtifacts = safeRunArtifactsPath(config.artifactsPath, runId)
    return { leftoverFiles: removeTreeAndCountFailures(runArtifacts) }
  })
}

export function readRunDeletionPreview(databasePath: string, runId: string): RunDeletionPreview {
  const database = openWorkspaceDatabase(databasePath, true)
  try {
    if (!database.prepare("select 1 from prospecting_runs where id = ?").get(runId)) {
      throw new Error("Run not found.")
    }
    return {
      discoveredBusinesses: Number(
        database
          .prepare("select count(*) from discovered_businesses where run_id = ?")
          .pluck()
          .get(runId),
      ),
      candidateBusinesses: Number(
        database
          .prepare("select count(*) from candidate_scores where run_id = ?")
          .pluck()
          .get(runId),
      ),
      evidenceArtifacts: Number(
        database
          .prepare(
            `select count(*) from inspection_artifacts ia
         join website_inspections wi on wi.id = ia.inspection_id
         where wi.run_id = ?`,
          )
          .pluck()
          .get(runId),
      ),
      sharedCanonicalBusinesses: Number(
        database
          .prepare(
            `select count(distinct rb.canonical_business_id)
         from run_businesses rb
         where rb.run_id = ? and rb.canonical_business_id is not null
         and exists (
           select 1 from run_businesses other
           where other.canonical_business_id = rb.canonical_business_id
           and other.run_id <> rb.run_id
         )`,
          )
          .pluck()
          .get(runId),
      ),
    }
  } finally {
    database.close()
  }
}

function runLabel(searchBrief: string, runId: string): string {
  try {
    const parsed = JSON.parse(searchBrief) as { category?: unknown; location?: unknown }
    const category = typeof parsed.category === "string" ? parsed.category : "Prospecting Run"
    const location = typeof parsed.location === "string" ? parsed.location : undefined
    return location ? `${category} in ${location}` : category
  } catch {
    return `#${runId.slice(0, 8)}`
  }
}
