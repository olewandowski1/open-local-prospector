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
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"

import type Database from "better-sqlite3"
import * as tar from "tar"

import { type LocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import {
  BackupValidationError,
  WorkspaceBusyError,
} from "@/features/workspace-administration/domain/workspace-errors"
import {
  assertCompleteTableClassification,
  openWorkspaceDatabase,
} from "@/features/workspace-administration/infrastructure/workspace-database"
import { withWorkspaceOperationLock } from "@/features/workspace-administration/infrastructure/workspace-operation-lock"

const BACKUP_FORMAT = "open-prospector-workspace"
const BACKUP_FORMAT_VERSION = 1
const MAX_BACKUP_BYTES = 5 * 1024 ** 3
const MAX_EXPANDED_BACKUP_BYTES = 20 * 1024 ** 3
const MAX_ARCHIVE_ENTRIES = 100_000
const MAX_METADATA_BYTES = 64 * 1024
const SAFE_CONFIGURATION_KEYS = new Set([
  "PROSPECTOR_BUSINESS_CONCURRENCY",
  "PROSPECTOR_DATABASE_PATH",
  "PROSPECTOR_ARTIFACTS_PATH",
])

export type BackupArtifact = Readonly<{
  path: string
  fileName: string
  size: number
  createStream: () => ReturnType<typeof createReadStream>
  cleanup: () => void
}>

export type RestoreResult = Readonly<{ recoveryBackupPath: string }>

type BackupManifest = Readonly<{
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  createdAt: string
  databaseFile: "database.sqlite"
  artifactsDirectory: "artifacts"
  configurationFile: "configuration.json"
}>

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
  const values: Record<string, string> = {
    PROSPECTOR_DATABASE_PATH: config.databasePath,
    PROSPECTOR_ARTIFACTS_PATH: config.artifactsPath,
  }
  for (const key of SAFE_CONFIGURATION_KEYS) {
    const value = process.env[key]
    if (value) values[key] = value
  }
  return values
}

function backupFileName(now: Date, qualifier?: string): string {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 19).replaceAll(":", "-")
  return `open-prospector-${date}-${time}${qualifier ? `-${qualifier}` : ""}.olp-backup.tgz`
}

function persistBackup(source: string, destination: string): string {
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { errorOnExist: true })
  return destination
}

async function extractBackup(archive: string, destination: string): Promise<void> {
  let expandedBytes = 0
  let entries = 0
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
        const size = "size" in entry ? entry.size : 0
        entries += 1
        expandedBytes += size
        const metadataTooLarge =
          ["workspace/manifest.json", "workspace/configuration.json"].includes(normalized) &&
          size > MAX_METADATA_BYTES
        const safe = !(
          !allowed ||
          normalized.includes("../") ||
          normalized.startsWith("/") ||
          ("type" in entry && !["File", "Directory"].includes(entry.type)) ||
          expandedBytes > MAX_EXPANDED_BACKUP_BYTES ||
          entries > MAX_ARCHIVE_ENTRIES ||
          metadataTooLarge
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
  let manifest: unknown
  let configuration: unknown
  try {
    manifest = JSON.parse(readFileSync(join(workspace, "manifest.json"), "utf8"))
    configuration = JSON.parse(readFileSync(join(workspace, "configuration.json"), "utf8"))
  } catch {
    throw new BackupValidationError("The backup metadata is missing or invalid.")
  }
  validateBackupMetadata(manifest, configuration)
  if (
    !existsSync(join(workspace, "database.sqlite")) ||
    !existsSync(join(workspace, "artifacts"))
  ) {
    throw new BackupValidationError("The backup does not contain the database and artifacts.")
  }
}

export function validateBackupMetadata(manifest: unknown, configuration: unknown): void {
  if (!isRecord(manifest)) {
    throw new BackupValidationError("The backup manifest is invalid.")
  }
  if (manifest.format !== BACKUP_FORMAT || manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError("This backup format is not supported by this version.")
  }
  if (
    manifest.databaseFile !== "database.sqlite" ||
    manifest.artifactsDirectory !== "artifacts" ||
    manifest.configurationFile !== "configuration.json" ||
    typeof manifest.createdAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.createdAt))
  ) {
    throw new BackupValidationError("The backup manifest is incomplete or invalid.")
  }
  if (!isRecord(configuration)) {
    throw new BackupValidationError("The backup configuration is invalid.")
  }
  for (const [key, value] of Object.entries(configuration)) {
    if (!SAFE_CONFIGURATION_KEYS.has(key) || typeof value !== "string" || value.length > 10_000) {
      throw new BackupValidationError("The backup configuration contains an unsupported value.")
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
    rmSync(sidecar, { force: true })
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
