import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import type { LocalApplicationConfig } from "@/features/local-application"
import { liftCandidateSuppression } from "@/features/review-queue"
import type {
  SuppressionRecord,
  WorkspaceInventory,
} from "@/features/workspace-administration/domain/workspace-presentation"
import {
  assertCompleteTableClassification,
  openWorkspaceDatabase,
} from "@/features/workspace-administration/infrastructure/workspace-database"

export function readWorkspaceInventory(config: LocalApplicationConfig): WorkspaceInventory {
  const database = openWorkspaceDatabase(config.databasePath, true)
  try {
    assertCompleteTableClassification(database)
    const artifactUsage = readDirectoryUsage(config.artifactsPath)
    return {
      databasePath: config.databasePath,
      databaseBytes: statSync(config.databasePath).size,
      artifactsPath: config.artifactsPath,
      artifactCount: artifactUsage.files,
      artifactBytes: artifactUsage.bytes,
      runs: count(database, "prospecting_runs"),
      discoveredBusinesses: count(database, "discovered_businesses"),
      qualifiedCandidates: scalar(
        database,
        "select count(*) from candidate_scores where qualified = 1",
      ),
      decisionsRecorded: scalar(
        database,
        "select count(*) from candidate_reviews where status <> 'Unreviewed'",
      ),
      technicalEvents: count(database, "technical_run_events"),
      suppressions: count(database, "suppression_entries"),
    }
  } finally {
    database.close()
  }
}

export function listSuppressions(databasePath: string): readonly SuppressionRecord[] {
  const database = openWorkspaceDatabase(databasePath, true)
  try {
    return database
      .prepare(
        `select identity_fingerprint, canonical_business_id, business_name, reason, created_at
       from suppression_entries order by created_at desc, business_name collate nocase`,
      )
      .all()
      .map((row) => {
        const value = row as {
          identity_fingerprint: string
          canonical_business_id: string | null
          business_name: string
          reason: string
          created_at: number
        }
        return {
          identityFingerprint: value.identity_fingerprint,
          canonicalBusinessId: value.canonical_business_id,
          businessName: value.business_name,
          reason: value.reason,
          createdAt: new Date(value.created_at).toISOString(),
        }
      })
  } finally {
    database.close()
  }
}

export function liftSuppression(databasePath: string, identityFingerprint: string): boolean {
  return liftCandidateSuppression(databasePath, identityFingerprint)
}

function count(database: ReturnType<typeof openWorkspaceDatabase>, table: string): number {
  return scalar(database, `select count(*) from ${table}`)
}

function scalar(database: ReturnType<typeof openWorkspaceDatabase>, statement: string): number {
  return Number(database.prepare(statement).pluck().get())
}

function readDirectoryUsage(path: string): Readonly<{ files: number; bytes: number }> {
  if (!existsSync(path)) return { files: 0, bytes: 0 }
  let files = 0
  let bytes = 0
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile()) {
        files += 1
        bytes += statSync(entryPath).size
      }
    }
  }
  visit(path)
  return { files, bytes }
}
