import {
  cpSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve, sep } from "node:path"

import Database from "better-sqlite3"
import * as tar from "tar"

import { type LocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import {
  BackupValidationError,
  WorkspaceBusyError,
} from "@/features/workspace-administration/domain/workspace-errors"
import type { WorkspaceInventory } from "@/features/workspace-administration/domain/workspace-presentation"
import {
  BOOKKEEPING_TABLES,
  CLASSIFIED_WORKSPACE_TABLES,
  PROSPECTING_DATA_TABLES,
  unclassifiedWorkspaceTables,
} from "@/features/workspace-administration/domain/workspace-schema"
import { withWorkspaceOperationLock } from "@/features/workspace-administration/infrastructure/workspace-operation-lock"

const BACKUP_FORMAT = "open-local-prospector-workspace"
const BACKUP_FORMAT_VERSION = 1
const MAX_BACKUP_BYTES = 5 * 1024 ** 3
const MAX_EXPANDED_BACKUP_BYTES = 20 * 1024 ** 3
const TERMINAL_RUN_STATES = ["Completed", "Cancelled"] as const

export type SuppressionRecord = Readonly<{
  identityFingerprint: string
  canonicalBusinessId: string | null
  businessName: string
  reason: string
  createdAt: string
}>

export type BackupArtifact = Readonly<{
  path: string
  fileName: string
  size: number
  createStream: () => ReturnType<typeof createReadStream>
  cleanup: () => void
}>

export type RestoreResult = Readonly<{ recoveryBackupPath: string }>
export type ArtifactCleanupResult = Readonly<{ removedFiles: number; leftoverFiles: number }>

export type RunDeletionPreview = Readonly<{
  discoveredBusinesses: number
  candidateBusinesses: number
  evidenceArtifacts: number
  sharedCanonicalBusinesses: number
}>

type BackupManifest = Readonly<{
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  createdAt: string
  databaseFile: "database.sqlite"
  artifactsDirectory: "artifacts"
  configurationFile: "configuration.json"
}>

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
  const database = openWorkspaceDatabase(databasePath)
  try {
    return (
      database
        .prepare("delete from suppression_entries where identity_fingerprint = ?")
        .run(identityFingerprint).changes === 1
    )
  } finally {
    database.close()
  }
}

export async function createWorkspaceBackup(
  config: LocalApplicationConfig,
  options: Readonly<{ keepAt?: string }> = {},
): Promise<BackupArtifact> {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "prospector-backup-"))
  const stage = join(temporaryDirectory, "workspace")
  const archivePath = join(temporaryDirectory, backupFileName(new Date()))
  mkdirSync(stage, { recursive: true })

  try {
    snapshotDatabase(config.databasePath, join(stage, "database.sqlite"))
    if (existsSync(config.artifactsPath)) {
      assertArtifactTreeContainsOnlyFiles(config.artifactsPath)
      cpSync(config.artifactsPath, join(stage, "artifacts"), {
        recursive: true,
        dereference: true,
        errorOnExist: true,
      })
    } else {
      mkdirSync(join(stage, "artifacts"), { recursive: true })
    }
    writeFileSync(
      join(stage, "configuration.json"),
      JSON.stringify(readSafeConfiguration(config), null, 2),
      "utf8",
    )
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      databaseFile: "database.sqlite",
      artifactsDirectory: "artifacts",
      configurationFile: "configuration.json",
    }
    writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
    await tar.create(
      {
        cwd: stage,
        file: archivePath,
        gzip: true,
        portable: true,
        prefix: "workspace/",
      },
      ["manifest.json", "configuration.json", "database.sqlite", "artifacts"],
    )

    const finalPath = options.keepAt ? persistBackup(archivePath, options.keepAt) : archivePath
    const cleanup = () => rmSync(temporaryDirectory, { recursive: true, force: true })
    return {
      path: finalPath,
      fileName: basename(finalPath),
      size: statSync(finalPath).size,
      createStream: () => createReadStream(finalPath),
      cleanup: options.keepAt ? () => cleanup() : cleanup,
    }
  } catch (error) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    if (isDiskFullError(error)) {
      throw new BackupValidationError(
        "There is not enough free disk space to create the workspace backup.",
      )
    }
    throw error
  }
}

export async function restoreWorkspaceBackup(
  config: LocalApplicationConfig,
  uploadedArchivePath: string,
): Promise<RestoreResult> {
  if (statSync(uploadedArchivePath).size > MAX_BACKUP_BYTES) {
    throw new BackupValidationError("The backup is larger than the 5 GB restore limit.")
  }

  return withWorkspaceOperationLock(config, async () => {
    assertNoActiveRun(config.databasePath)
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "prospector-restore-"))
    const extractionRoot = join(temporaryDirectory, "extract")
    mkdirSync(extractionRoot, { recursive: true })

    try {
      await extractBackup(uploadedArchivePath, extractionRoot)
      const workspace = join(extractionRoot, "workspace")
      validateManifest(workspace)
      const restoredDatabase = join(workspace, "database.sqlite")
      validateAndMigrateDatabase(restoredDatabase, config.databasePath)

      const recoveryDirectory = join(dirname(config.databasePath), "recovery")
      mkdirSync(recoveryDirectory, { recursive: true })
      const recovery = await createWorkspaceBackup(config, {
        keepAt: join(recoveryDirectory, backupFileName(new Date(), "before-restore")),
      })
      recovery.cleanup()

      assertNoActiveRun(config.databasePath)
      replaceWorkspace(config, restoredDatabase, join(workspace, "artifacts"))
      return { recoveryBackupPath: recovery.path }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
}

export function resetWorkspace(
  config: LocalApplicationConfig,
): Readonly<{ leftoverFiles: number }> {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    try {
      assertCompleteTableClassification(database)
      assertNoActiveRunInConnection(database)
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

export function deleteBusiness(
  config: LocalApplicationConfig,
  scoreId: string,
): Readonly<{ leftoverFiles: number }> {
  return withWorkspaceOperationLock(config, () => {
    const database = openWorkspaceDatabase(config.databasePath)
    let artifactPaths: string[] = []
    try {
      assertNoActiveRunInConnection(database)
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
      // Deleting stored data is not a decision about contacting anyone; a Suppression Entry is what Suppress is for.
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
      assertNoActiveRunInConnection(database)
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
      database.transaction(() => {
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
      })()
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

export function compactWorkspace(config: LocalApplicationConfig): Readonly<{
  beforeBytes: number
  afterBytes: number
}> {
  return withWorkspaceOperationLock(config, () => {
    const beforeBytes = statSync(config.databasePath).size
    const database = openWorkspaceDatabase(config.databasePath)
    try {
      assertNoActiveRunInConnection(database)
      database.exec("vacuum")
    } finally {
      database.close()
    }
    return { beforeBytes, afterBytes: statSync(config.databasePath).size }
  })
}

export function assertCompleteTableClassification(database: Database.Database): void {
  const actual = database
    .prepare(
      "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name",
    )
    .all()
    .map((row) => (row as { name: string }).name)
  const unknown = unclassifiedWorkspaceTables(actual)
  const missing = [...CLASSIFIED_WORKSPACE_TABLES, ...BOOKKEEPING_TABLES].filter(
    (table) => !actual.includes(table),
  )
  if (unknown.length || missing.length) {
    throw new Error(
      `Workspace table classification is out of date. Unknown: ${unknown.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    )
  }
}

function openWorkspaceDatabase(path: string, readonly = false): Database.Database {
  const database = new Database(path, { readonly, fileMustExist: true })
  database.pragma("foreign_keys = ON")
  database.pragma("busy_timeout = 5000")
  return database
}

function count(database: Database.Database, table: string): number {
  return scalar(database, `select count(*) from ${table}`)
}

function scalar(database: Database.Database, statement: string): number {
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

function snapshotDatabase(source: string, destination: string): void {
  const database = openWorkspaceDatabase(source, true)
  try {
    try {
      database.exec(`vacuum into '${destination.replaceAll("'", "''")}'`)
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (/disk.*full|database.*full|ENOSPC/iu.test(message)) {
        throw new BackupValidationError(
          "There is not enough free disk space to create the database snapshot.",
        )
      }
      throw error
    }
    const snapshot = openWorkspaceDatabase(destination, true)
    try {
      if (snapshot.pragma("integrity_check", { simple: true }) !== "ok") {
        throw new Error("The database snapshot failed its integrity check.")
      }
    } finally {
      snapshot.close()
    }
  } finally {
    database.close()
  }
}

function isDiskFullError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  const message = error instanceof Error ? error.message : ""
  return code === "ENOSPC" || /disk.*full|database.*full|ENOSPC/iu.test(message)
}

function assertArtifactTreeContainsOnlyFiles(path: string): void {
  for (const entry of readdirSync(path)) {
    const entryPath = join(path, entry)
    const stat = lstatSync(entryPath)
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new BackupValidationError(
        "The artifacts directory contains a link or special file that cannot be backed up safely.",
      )
    }
    if (stat.isDirectory()) assertArtifactTreeContainsOnlyFiles(entryPath)
  }
}

function readSafeConfiguration(config: LocalApplicationConfig): Readonly<Record<string, string>> {
  const safeKeys = [
    "PROSPECTOR_BUSINESS_CONCURRENCY",
    "PROSPECTOR_DATABASE_PATH",
    "PROSPECTOR_ARTIFACTS_PATH",
  ] as const
  const values: Record<string, string> = {
    PROSPECTOR_DATABASE_PATH: config.databasePath,
    PROSPECTOR_ARTIFACTS_PATH: config.artifactsPath,
  }
  for (const key of safeKeys) {
    const value = process.env[key]
    if (value) values[key] = value
  }
  return values
}

function backupFileName(now: Date, qualifier?: string): string {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 19).replaceAll(":", "-")
  return `open-local-prospector-${date}-${time}${qualifier ? `-${qualifier}` : ""}.olp-backup.tgz`
}

function persistBackup(source: string, destination: string): string {
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { errorOnExist: true })
  return destination
}

async function extractBackup(archive: string, destination: string): Promise<void> {
  let expandedBytes = 0
  let unsafeEntry = false
  try {
    await tar.extract({
      cwd: destination,
      file: archive,
      strict: true,
      preservePaths: false,
      filter: (path, entry) => {
        const normalized = path.replaceAll("\\", "/")
        const allowed =
          [
            "workspace/manifest.json",
            "workspace/configuration.json",
            "workspace/database.sqlite",
            "workspace/artifacts",
            "workspace/artifacts/",
          ].includes(normalized) || normalized.startsWith("workspace/artifacts/")
        expandedBytes += "size" in entry ? entry.size : 0
        const safe = !(
          !allowed ||
          normalized.includes("../") ||
          normalized.startsWith("/") ||
          ("type" in entry && !["File", "Directory"].includes(entry.type)) ||
          expandedBytes > MAX_EXPANDED_BACKUP_BYTES
        )
        if (!safe) unsafeEntry = true
        return safe
      },
    })
    if (unsafeEntry) {
      throw new BackupValidationError("The backup contains an unsafe archive entry.")
    }
  } catch (error) {
    if (error instanceof BackupValidationError) throw error
    throw new BackupValidationError("The selected file is not a valid workspace backup.")
  }
}

function validateManifest(workspace: string): void {
  let manifest: Partial<BackupManifest>
  try {
    manifest = JSON.parse(
      readFileSync(join(workspace, "manifest.json"), "utf8"),
    ) as Partial<BackupManifest>
  } catch {
    throw new BackupValidationError("The backup manifest is missing or invalid.")
  }
  if (manifest.format !== BACKUP_FORMAT || manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError("This backup format is not supported by this version.")
  }
  if (
    !existsSync(join(workspace, "database.sqlite")) ||
    !existsSync(join(workspace, "artifacts"))
  ) {
    throw new BackupValidationError("The backup does not contain the database and artifacts.")
  }
}

function validateAndMigrateDatabase(restoredPath: string, livePath: string): void {
  const restored = openWorkspaceDatabase(restoredPath, true)
  const live = openWorkspaceDatabase(livePath, true)
  try {
    if (restored.pragma("integrity_check", { simple: true }) !== "ok") {
      throw new BackupValidationError("The backup database failed its integrity check.")
    }
    const restoredMigrations = migrationRows(restored)
    const liveMigrations = migrationRows(live)
    if (restoredMigrations.length > liveMigrations.length) {
      throw new BackupValidationError("The backup was created by a newer application version.")
    }
    for (let index = 0; index < restoredMigrations.length; index += 1) {
      const restoredMigration = restoredMigrations[index]
      const liveMigration = liveMigrations[index]
      if (
        !restoredMigration ||
        !liveMigration ||
        restoredMigration.hash !== liveMigration.hash ||
        restoredMigration.createdAt !== liveMigration.createdAt
      ) {
        throw new BackupValidationError(
          "The backup database has an incompatible migration history.",
        )
      }
    }
  } finally {
    restored.close()
    live.close()
  }
  migrateLocalDatabase(restoredPath)
  const migrated = openWorkspaceDatabase(restoredPath, true)
  try {
    assertCompleteTableClassification(migrated)
    if (migrated.pragma("integrity_check", { simple: true }) !== "ok") {
      throw new BackupValidationError("The migrated backup failed its integrity check.")
    }
  } finally {
    migrated.close()
  }
}

function migrationRows(database: Database.Database): readonly {
  hash: string
  createdAt: number
}[] {
  return database
    .prepare("select hash, created_at from __drizzle_migrations order by created_at")
    .all()
    .map((row) => {
      const value = row as { hash: string; created_at: number }
      return { hash: value.hash, createdAt: value.created_at }
    })
}

function replaceWorkspace(
  config: LocalApplicationConfig,
  restoredDatabase: string,
  restoredArtifacts: string,
): void {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`
  const nextDatabase = `${config.databasePath}.restore-next-${suffix}`
  const oldDatabase = `${config.databasePath}.restore-old-${suffix}`
  const nextArtifacts = `${config.artifactsPath}.restore-next-${suffix}`
  const oldArtifacts = `${config.artifactsPath}.restore-old-${suffix}`
  cpSync(restoredDatabase, nextDatabase, { errorOnExist: true })
  cpSync(restoredArtifacts, nextArtifacts, { recursive: true, errorOnExist: true })
  checkpointDatabase(config.databasePath)

  let databaseMoved = false
  let artifactsMoved = false
  let databaseInstalled = false
  let artifactsInstalled = false
  try {
    renameSync(config.databasePath, oldDatabase)
    databaseMoved = true
    if (existsSync(config.artifactsPath)) {
      renameSync(config.artifactsPath, oldArtifacts)
      artifactsMoved = true
    }
    renameSync(nextDatabase, config.databasePath)
    databaseInstalled = true
    renameSync(nextArtifacts, config.artifactsPath)
    artifactsInstalled = true
    rmSync(oldDatabase, { force: true })
    if (artifactsMoved) rmSync(oldArtifacts, { recursive: true, force: true })
  } catch (error) {
    if (databaseInstalled) rmSync(config.databasePath, { force: true })
    if (databaseMoved && existsSync(oldDatabase)) {
      renameSync(oldDatabase, config.databasePath)
    }
    if (artifactsInstalled) rmSync(config.artifactsPath, { recursive: true, force: true })
    if (artifactsMoved && existsSync(oldArtifacts)) {
      renameSync(oldArtifacts, config.artifactsPath)
    }
    throw error
  } finally {
    rmSync(nextDatabase, { force: true })
    rmSync(nextArtifacts, { recursive: true, force: true })
  }
}

function checkpointDatabase(path: string): void {
  const database = openWorkspaceDatabase(path)
  try {
    database.pragma("wal_checkpoint(TRUNCATE)")
  } finally {
    database.close()
  }
  for (const sidecar of [`${path}-wal`, `${path}-shm`]) {
    if (existsSync(sidecar)) unlinkSync(sidecar)
  }
}

function assertNoActiveRun(databasePath: string): void {
  const database = openWorkspaceDatabase(databasePath, true)
  try {
    assertNoActiveRunInConnection(database)
  } finally {
    database.close()
  }
}

function assertNoActiveRunInConnection(database: Database.Database): void {
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

function safeRunArtifactsPath(root: string, runId: string): string {
  const target = resolve(root, "inspections", runId)
  const allowedRoot = `${resolve(root, "inspections")}${sep}`
  if (!target.startsWith(allowedRoot)) throw new Error("Unsafe run artifact path.")
  return target
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

function removeTreeAndCountFailures(path: string): number {
  if (!existsSync(path)) return 0
  try {
    rmSync(path, { recursive: true, force: true })
    return 0
  } catch {
    return countTreeFiles(path)
  }
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

function countTreeFiles(path: string): number {
  if (!existsSync(path)) return 0
  const stat = lstatSync(path)
  if (!stat.isDirectory()) return 1
  return readdirSync(path).reduce((total, entry) => total + countTreeFiles(join(path, entry)), 0)
}
