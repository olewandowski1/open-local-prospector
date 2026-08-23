import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { join, resolve, sep } from "node:path"

import type Database from "better-sqlite3"

import type { LocalApplicationConfig } from "@/features/local-application"
import { WorkspaceBusyError } from "@/features/workspace-administration/domain/workspace-errors"
import { PROSPECTING_DATA_TABLES } from "@/features/workspace-administration/domain/workspace-schema"
import { removeTreeAndCountFailures } from "@/features/workspace-administration/infrastructure/workspace-artifacts"
import {
  assertCompleteTableClassification,
  openWorkspaceDatabase,
} from "@/features/workspace-administration/infrastructure/workspace-database"
import { withWorkspaceOperationLock } from "@/features/workspace-administration/infrastructure/workspace-operation-lock"

export type ArtifactCleanupResult = Readonly<{ removedFiles: number; leftoverFiles: number }>

export function resetWorkspace(
  config: LocalApplicationConfig,
): Readonly<{ leftoverFiles: number }> {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    try {
      assertCompleteTableClassification(database)
      assertNoActiveRun(database)
      database.transaction(() => {
        database.pragma("defer_foreign_keys = ON")
        for (const table of PROSPECTING_DATA_TABLES) database.exec(`delete from ${table}`)
      })()
    } finally {
      database.close()
    }
    return { leftoverFiles: clearDirectoryContents(config.artifactsPath) }
  })
}

export function deleteBusiness(
  config: LocalApplicationConfig,
  scoreId: string,
): Readonly<{ leftoverFiles: number }> {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    let artifactPaths: string[] = []
    try {
      assertNoActiveRun(database)
      const business = database
        .prepare(
          `select cb.id, cb.identity_fingerprint, cb.name
         from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id
         where cs.id=?`,
        )
        .get(scoreId) as { id: string; identity_fingerprint: string; name: string } | undefined
      if (!business) throw new Error("Business not found.")
      const associations = database
        .prepare(
          "select id, discovered_business_id from run_businesses where canonical_business_id=?",
        )
        .all(business.id) as { id: string; discovered_business_id: string }[]
      artifactPaths = database
        .prepare(
          `select distinct ia.path from inspection_artifacts ia
         join website_inspections wi on wi.id=ia.inspection_id
         where wi.canonical_business_id=?`,
        )
        .all(business.id)
        .map((row) => (row as { path: string }).path)
      database.transaction(() => {
        const deleteTasks = database.prepare("delete from run_tasks where business_id=?")
        const deleteRunBusiness = database.prepare("delete from run_businesses where id=?")
        const deleteDiscovered = database.prepare("delete from discovered_businesses where id=?")
        for (const association of associations) {
          deleteTasks.run(association.id)
          deleteRunBusiness.run(association.id)
          deleteDiscovered.run(association.discovered_business_id)
        }
        database.prepare("delete from canonical_businesses where id=?").run(business.id)
      })()
    } finally {
      database.close()
    }
    return { leftoverFiles: removeArtifactPaths(config.artifactsPath, artifactPaths) }
  })
}

export function cleanupArchivedArtifacts(config: LocalApplicationConfig): ArtifactCleanupResult {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    let archivedPaths: string[] = []
    let referencedPaths = new Set<string>()
    try {
      assertNoActiveRun(database)
      archivedPaths = database
        .prepare(
          `select distinct ia.path from inspection_artifacts ia
         join website_inspections wi on wi.id=ia.inspection_id
         join candidate_scores cs on cs.run_business_id=wi.run_business_id
         join candidate_reviews cr on cr.score_id=cs.id
         where cr.status='Archived'`,
        )
        .all()
        .map((row) => (row as { path: string }).path)
      database
        .prepare(
          `delete from inspection_artifacts where path in (
         select ia.path from inspection_artifacts ia
         join website_inspections wi on wi.id=ia.inspection_id
         join candidate_scores cs on cs.run_business_id=wi.run_business_id
         join candidate_reviews cr on cr.score_id=cs.id
         where cr.status='Archived'
       )`,
        )
        .run()
      referencedPaths = new Set(
        database
          .prepare("select path from inspection_artifacts")
          .all()
          .map((row) => resolve((row as { path: string }).path)),
      )
    } finally {
      database.close()
    }
    const orphanPaths = listFiles(config.artifactsPath).filter(
      (path) => !referencedPaths.has(resolve(path)),
    )
    const paths = [...new Set([...archivedPaths, ...orphanPaths])]
    const leftoverFiles = removeArtifactPaths(config.artifactsPath, paths)
    return { removedFiles: paths.length - leftoverFiles, leftoverFiles }
  })
}

export function compactWorkspace(config: LocalApplicationConfig): Readonly<{
  beforeBytes: number
  afterBytes: number
}> {
  return withWorkspaceOperationLock(config, () => {
    const beforeBytes = statSync(config.databasePath).size
    const database = openWorkspaceDatabase(config.databasePath)
    try {
      assertNoActiveRun(database)
      database.exec("vacuum")
    } finally {
      database.close()
    }
    return { beforeBytes, afterBytes: statSync(config.databasePath).size }
  })
}

function assertNoActiveRun(database: Database.Database): void {
  const active = database
    .prepare(
      "select id, search_brief from prospecting_runs where state not in ('Completed','Cancelled') order by created_at limit 1",
    )
    .get() as { id: string; search_brief: string } | undefined
  if (active) throw new WorkspaceBusyError(active.id, runLabel(active.search_brief, active.id))
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

function clearDirectoryContents(path: string): number {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
    return 0
  }
  let failures = 0
  for (const entry of readdirSync(path)) failures += removeTreeAndCountFailures(join(path, entry))
  return failures
}

function listFiles(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name)
    return entry.isDirectory() ? listFiles(entryPath) : entry.isFile() ? [entryPath] : []
  })
}

function removeArtifactPaths(root: string, paths: readonly string[]): number {
  const allowedRoot = `${resolve(root)}${sep}`
  let failures = 0
  for (const path of paths) {
    const target = resolve(path)
    if (!target.startsWith(allowedRoot)) {
      failures += 1
      continue
    }
    try {
      rmSync(target, { force: true })
    } catch {
      failures += 1
    }
  }
  return failures
}
