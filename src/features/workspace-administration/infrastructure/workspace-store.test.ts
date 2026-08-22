import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import Database from "better-sqlite3"
import * as tar from "tar"
import { afterEach, describe, expect, it } from "vitest"

import type { LocalApplicationConfig } from "@/features/local-application"
import { WorkspaceBusyError } from "@/features/workspace-administration/domain/workspace-errors"
import { PROSPECTING_DATA_TABLES } from "@/features/workspace-administration/domain/workspace-schema"
import {
  isWorkspaceMaintenanceActive,
  tryAcquireWorkspaceOperationLease,
  withWorkspaceOperationLock,
} from "@/features/workspace-administration/infrastructure/workspace-operation-lock"
import {
  assertCompleteTableClassification,
  cleanupArchivedArtifacts,
  createWorkspaceBackup,
  deleteBusiness,
  deleteRun,
  readRunDeletionPreview,
  readWorkspaceInventory,
  resetWorkspace,
  restoreWorkspaceBackup,
} from "@/features/workspace-administration/infrastructure/workspace-store"
import { createMigratedTestDatabase } from "@/test-support/local-database"

const cleanups: Array<() => void> = []

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

describe("workspace store", () => {
  it("classifies the migrated schema and reports live database and artifact figures", () => {
    const fixture = workspaceFixture()
    const database = new Database(fixture.config.databasePath)
    try {
      assertCompleteTableClassification(database)
      seedRun(database, "run-1", "Completed")
      database.pragma("foreign_keys = OFF")
      database
        .prepare(
          "insert into discovered_businesses (id,run_id,source,source_identifier,discovery_key,name,normalized_name,result_url,raw_attributes,discovered_at) values ('discovered','run-1','Search','source','key','Business','business','https://example.com','{}',1)",
        )
        .run()
      seedCandidate(database, "counted", "Shortlisted", "unused")
      database
        .prepare(
          "insert into suppression_entries (identity_fingerprint,canonical_business_id,business_name,reason,created_at) values ('suppressed',null,'Suppressed','No',1)",
        )
        .run()
      database
        .prepare(
          "insert into technical_run_events (id,run_id,kind,message,created_at) values ('event-1','run-1','Info','Done',1)",
        )
        .run()
    } finally {
      database.close()
    }
    writeFileSync(join(fixture.config.artifactsPath, "evidence.txt"), "evidence", "utf8")

    const inventory = readWorkspaceInventory(fixture.config)
    expect(inventory).toEqual({
      databasePath: fixture.config.databasePath,
      databaseBytes: statSync(fixture.config.databasePath).size,
      artifactsPath: fixture.config.artifactsPath,
      artifactCount: 1,
      artifactBytes: 8,
      runs: 1,
      discoveredBusinesses: 1,
      qualifiedCandidates: 1,
      decisionsRecorded: 1,
      technicalEvents: 1,
      suppressions: 1,
    })
  })

  it("holds the operation lock until asynchronous work settles", async () => {
    const fixture = workspaceFixture()
    let finish: (() => void) | undefined
    const work = withWorkspaceOperationLock(
      fixture.config,
      () => new Promise<void>((resolve) => (finish = resolve)),
    )
    expect(isWorkspaceMaintenanceActive(fixture.config.databasePath)).toBe(true)
    finish?.()
    await work
    expect(isWorkspaceMaintenanceActive(fixture.config.databasePath)).toBe(false)
  })

  it("does not report maintenance while the worker holds the lease", () => {
    const fixture = workspaceFixture()
    const release = tryAcquireWorkspaceOperationLease(fixture.config.databasePath)
    cleanups.push(() => release?.())

    expect(release).toBeDefined()
    expect(isWorkspaceMaintenanceActive(fixture.config.databasePath)).toBe(false)
    release?.()
  })

  it("rejects link entries in restore archives", async () => {
    const fixture = workspaceFixture()
    const directory = mkdtempSync(join(tmpdir(), "prospector-unsafe-backup-"))
    cleanups.push(() => rmDirectory(directory))
    const workspace = join(directory, "workspace")
    const artifacts = join(workspace, "artifacts")
    const outside = join(directory, "outside")
    mkdirSync(artifacts, { recursive: true })
    mkdirSync(outside)
    symlinkSync(outside, join(artifacts, "linked"), "junction")
    writeFileSync(join(workspace, "manifest.json"), "{}")
    writeFileSync(join(workspace, "configuration.json"), "{}")
    writeFileSync(join(workspace, "database.sqlite"), "not reached")
    const archive = join(directory, "unsafe.tgz")
    await tar.create({ cwd: workspace, file: archive, gzip: true, prefix: "workspace/" }, [
      "manifest.json",
      "configuration.json",
      "database.sqlite",
      "artifacts",
    ])
    await expect(restoreWorkspaceBackup(fixture.config, archive)).rejects.toThrow(
      "unsafe archive entry",
    )
  })

  it("cleans archived and orphaned artifacts while preserving live artifacts", () => {
    const fixture = workspaceFixture()
    const archived = join(fixture.config.artifactsPath, "archived.png")
    const live = join(fixture.config.artifactsPath, "live.png")
    const orphan = join(fixture.config.artifactsPath, "orphan.png")
    for (const path of [archived, live, orphan]) writeFileSync(path, "image")
    const database = new Database(fixture.config.databasePath)
    try {
      database.pragma("foreign_keys = OFF")
      seedCandidate(database, "archived", "Archived", archived)
      seedCandidate(database, "live", "Shortlisted", live)
    } finally {
      database.close()
    }

    expect(cleanupArchivedArtifacts(fixture.config)).toEqual({
      removedFiles: 2,
      leftoverFiles: 0,
    })
    expect(existsSync(archived)).toBe(false)
    expect(existsSync(orphan)).toBe(false)
    expect(existsSync(live)).toBe(true)
  })

  it("resets prospecting data and artifacts while retaining choices, cache and suppressions", () => {
    const fixture = workspaceFixture()
    const database = new Database(fixture.config.databasePath)
    let migrationCount: number
    try {
      seedRun(database, "run-1", "Completed")
      database
        .prepare("insert into local_preferences (key,value,updated_at) values ('theme','dark',1)")
        .run()
      database
        .prepare(
          "insert into runtime_preferences (key,runtime_id,updated_at) values ('selected','codex',1)",
        )
        .run()
      database
        .prepare(
          "insert into prospecting_defaults (key,category,target_count,mode,updated_at) values ('last','Cafes',5,'Quick',1)",
        )
        .run()
      database
        .prepare(
          "insert into geocoding_cache (query,results,expires_at) values ('Krakow','[]',999999)",
        )
        .run()
      database
        .prepare(
          "insert into suppression_entries (identity_fingerprint,canonical_business_id,business_name,reason,created_at) values ('stable-id',null,'Kept Business','Not relevant',1)",
        )
        .run()
      migrationCount = Number(
        database.prepare("select count(*) from __drizzle_migrations").pluck().get(),
      )
    } finally {
      database.close()
    }
    writeFileSync(join(fixture.config.artifactsPath, "remove.txt"), "remove", "utf8")

    expect(resetWorkspace(fixture.config)).toEqual({ leftoverFiles: 0 })

    const checked = new Database(fixture.config.databasePath, { readonly: true })
    try {
      for (const table of PROSPECTING_DATA_TABLES) {
        expect(Number(checked.prepare(`select count(*) from ${table}`).pluck().get()), table).toBe(
          0,
        )
      }
      expect(Number(checked.prepare("select count(*) from local_preferences").pluck().get())).toBe(
        1,
      )
      expect(
        Number(checked.prepare("select count(*) from runtime_preferences").pluck().get()),
      ).toBe(1)
      expect(
        Number(checked.prepare("select count(*) from prospecting_defaults").pluck().get()),
      ).toBe(1)
      expect(Number(checked.prepare("select count(*) from geocoding_cache").pluck().get())).toBe(1)
      expect(
        Number(checked.prepare("select count(*) from suppression_entries").pluck().get()),
      ).toBe(1)
      expect(
        Number(checked.prepare("select count(*) from __drizzle_migrations").pluck().get()),
      ).toBe(migrationCount)
    } finally {
      checked.close()
    }
    expect(readWorkspaceInventory(fixture.config).artifactCount).toBe(0)
  })

  it("refuses reset and restore while a run can still make progress", async () => {
    const fixture = workspaceFixture()
    const database = new Database(fixture.config.databasePath)
    try {
      seedRun(database, "active-run", "Paused")
    } finally {
      database.close()
    }
    expect(() => resetWorkspace(fixture.config)).toThrow(WorkspaceBusyError)

    const backup = await createWorkspaceBackup(fixture.config)
    try {
      await expect(restoreWorkspaceBackup(fixture.config, backup.path)).rejects.toThrow(
        WorkspaceBusyError,
      )
    } finally {
      backup.cleanup()
    }
  })

  it("creates and restores a complete application backup", async () => {
    const fixture = workspaceFixture()
    const database = new Database(fixture.config.databasePath)
    try {
      database
        .prepare("insert into local_preferences (key,value,updated_at) values ('theme','dark',1)")
        .run()
    } finally {
      database.close()
    }
    writeFileSync(join(fixture.config.artifactsPath, "original.txt"), "original", "utf8")
    const backup = await createWorkspaceBackup(fixture.config)

    try {
      const changed = new Database(fixture.config.databasePath)
      try {
        changed
          .prepare("update local_preferences set value='light',updated_at=2 where key='theme'")
          .run()
      } finally {
        changed.close()
      }
      writeFileSync(join(fixture.config.artifactsPath, "original.txt"), "changed", "utf8")
      writeFileSync(join(fixture.config.artifactsPath, "extra.txt"), "extra", "utf8")

      const result = await restoreWorkspaceBackup(fixture.config, backup.path)

      const restored = new Database(fixture.config.databasePath, { readonly: true })
      try {
        expect(
          restored.prepare("select value from local_preferences where key='theme'").pluck().get(),
        ).toBe("dark")
        expect(restored.pragma("integrity_check", { simple: true })).toBe("ok")
      } finally {
        restored.close()
      }
      expect(readFileSync(join(fixture.config.artifactsPath, "original.txt"), "utf8")).toBe(
        "original",
      )
      expect(existsSync(join(fixture.config.artifactsPath, "extra.txt"))).toBe(false)
      expect(existsSync(result.recoveryBackupPath)).toBe(true)
    } finally {
      backup.cleanup()
    }
  })

  it("deletes a business without recording it as Do Not Contact", () => {
    const fixture = workspaceFixture()
    const evidence = join(fixture.config.artifactsPath, "gone.png")
    writeFileSync(evidence, "image")
    const database = new Database(fixture.config.databasePath)
    try {
      seedRun(database, "run-gone", "Completed")
      database.pragma("foreign_keys = OFF")
      database
        .prepare(
          "insert into canonical_businesses (id,identity_fingerprint,name,normalized_name,locality,country_code,decision_scope,created_at,updated_at) values ('canonical-gone','fingerprint-gone','Gone','gone','Krakow','PL','Local',1,1)",
        )
        .run()
      database
        .prepare(
          "insert into discovered_businesses (id,run_id,source,source_identifier,discovery_key,name,normalized_name,result_url,raw_attributes,discovered_at) values ('discovered-gone','run-gone','Search','source','key-gone','Gone','gone','https://example.com','{}',1)",
        )
        .run()
      database
        .prepare(
          "insert into run_businesses (id,run_id,discovered_business_id,canonical_business_id,status,identity_confidence,signals,created_at,updated_at) values ('business-gone','run-gone','discovered-gone','canonical-gone','Eligible','Corroborated','[]',1,1)",
        )
        .run()
      seedCandidate(database, "gone", "Shortlisted", evidence)
    } finally {
      database.close()
    }

    expect(deleteBusiness(fixture.config, "score-gone")).toEqual({ leftoverFiles: 0 })
    expect(existsSync(evidence)).toBe(false)

    const checked = new Database(fixture.config.databasePath, { readonly: true })
    try {
      expect(
        Number(checked.prepare("select count(*) from canonical_businesses").pluck().get()),
      ).toBe(0)
      expect(
        Number(checked.prepare("select count(*) from suppression_entries").pluck().get()),
      ).toBe(0)
    } finally {
      checked.close()
    }
  })

  it("deletes one run without removing a canonical business shared by another", () => {
    const fixture = workspaceFixture()
    const database = new Database(fixture.config.databasePath)
    try {
      seedRun(database, "run-1", "Completed")
      seedRun(database, "run-2", "Cancelled")
      database
        .prepare(
          "insert into canonical_businesses (id,identity_fingerprint,name,normalized_name,locality,country_code,decision_scope,created_at,updated_at) values ('canonical','fingerprint','Shared','shared','Krakow','PL','Local',1,1)",
        )
        .run()
      for (const runId of ["run-1", "run-2"]) {
        const discoveredId = `discovered-${runId}`
        database
          .prepare(
            "insert into discovered_businesses (id,run_id,source,source_identifier,discovery_key,name,normalized_name,result_url,raw_attributes,discovered_at) values (?,?,'Search','source',?,'Shared','shared','https://example.com','{}',1)",
          )
          .run(discoveredId, runId, discoveredId)
        database
          .prepare(
            "insert into run_businesses (id,run_id,discovered_business_id,canonical_business_id,status,identity_confidence,signals,created_at,updated_at) values (?,?,?,'canonical','Eligible','Corroborated','[]',1,1)",
          )
          .run(`business-${runId}`, runId, discoveredId)
      }
    } finally {
      database.close()
    }
    const runDirectory = join(fixture.config.artifactsPath, "inspections", "run-1")
    mkdirSync(runDirectory, { recursive: true })
    writeFileSync(join(runDirectory, "shot.png"), "image", "utf8")

    expect(readRunDeletionPreview(fixture.config.databasePath, "run-1")).toEqual({
      discoveredBusinesses: 1,
      candidateBusinesses: 0,
      evidenceArtifacts: 0,
      sharedCanonicalBusinesses: 1,
    })

    expect(deleteRun(fixture.config, "run-1")).toEqual({ leftoverFiles: 0 })
    const checked = new Database(fixture.config.databasePath, { readonly: true })
    try {
      expect(Number(checked.prepare("select count(*) from prospecting_runs").pluck().get())).toBe(1)
      expect(
        Number(checked.prepare("select count(*) from canonical_businesses").pluck().get()),
      ).toBe(1)
      expect(checked.prepare("select run_id from run_businesses").pluck().get()).toBe("run-2")
    } finally {
      checked.close()
    }
    expect(existsSync(runDirectory)).toBe(false)
  })
})

function workspaceFixture(): Readonly<{ config: LocalApplicationConfig }> {
  const database = createMigratedTestDatabase()
  cleanups.push(database.cleanup)
  const artifactsPath = join(dirname(database.path), "artifacts")
  mkdirSync(artifactsPath, { recursive: true })
  return {
    config: {
      databasePath: database.path,
      artifactsPath,
      environmentPath: join(dirname(database.path), ".env.local"),
      environmentTemplatePath: join(dirname(database.path), ".env.local.example"),
    },
  }
}

function seedRun(database: Database.Database, id: string, state: string): void {
  database
    .prepare(
      "insert into prospecting_runs (id,request_id,state,search_brief,created_at,updated_at) values (?,?,?,?,1,1)",
    )
    .run(
      id,
      `request-${id}`,
      state,
      JSON.stringify({ category: "Cafes", location: "Krakow", targetCount: 5 }),
    )
}

function seedCandidate(
  database: Database.Database,
  id: string,
  status: string,
  artifactPath: string,
): void {
  database
    .prepare(
      `insert into website_inspections
       (id,run_id,task_id,run_business_id,canonical_business_id,status,configuration_version,started_at,completed_at)
       values (?,?,?,?,?,'Completed','v1',1,1)`,
    )
    .run(
      `inspection-${id}`,
      `run-${id}`,
      `inspection-task-${id}`,
      `business-${id}`,
      `canonical-${id}`,
    )
  database
    .prepare(
      `insert into candidate_scores
       (id,run_id,task_id,run_business_id,canonical_business_id,assessment_id,rubric_version,severity_component,confidence_component,contact_component,local_decision_component,commercial_value_component,total,qualified,scored_at)
       values (?,?,?,?,?,?,'v1',1,1,1,1,1,5,1,1)`,
    )
    .run(
      `score-${id}`,
      `run-${id}`,
      `score-task-${id}`,
      `business-${id}`,
      `canonical-${id}`,
      `assessment-${id}`,
    )
  database
    .prepare(
      "insert into candidate_reviews (id,score_id,status,private_notes,updated_at) values (?,?,?,'note',1)",
    )
    .run(`review-${id}`, `score-${id}`, status)
  database
    .prepare(
      `insert into inspection_artifacts
       (id,inspection_id,page_id,kind,viewport,path,mime_type,byte_size,sha256,created_at)
       values (?,?,?,'Screenshot','Desktop',?,'image/png',5,'hash',1)`,
    )
    .run(`artifact-${id}`, `inspection-${id}`, `page-${id}`, artifactPath)
}

function rmDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true })
}
