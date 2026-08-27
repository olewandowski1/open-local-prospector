import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import { makeReassessmentSeedTaskExecutor } from "@/features/business-discovery/application/seed-reassessment"
import { makeSqliteDiscoveryRepository } from "@/features/business-discovery/infrastructure/sqlite-discovery-repository"
import { closeSharedDatabases } from "@/features/local-application"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

const directories: string[] = []
afterEach(() => {
  closeSharedDatabases()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), "prospector-seed-reassessment-"))
  directories.push(directory)
  const databasePath = join(directory, "workspace.sqlite")
  seedE2eWorkspace(databasePath, join(directory, "artifacts"))
  return databasePath
}

function task(databasePath: string, canonicalBusinessIds: readonly string[]) {
  const database = new Database(databasePath)
  const runId = database
    .prepare("select id from prospecting_runs order by created_at limit 1")
    .pluck()
    .get() as string
  const taskId = crypto.randomUUID()
  database
    .prepare(
      `insert into run_tasks (id, run_id, stage, status, attempt_count, max_attempts, available_at,
        input, schema_version, version, created_at, updated_at)
       values (?, ?, 'SeedReassessment', 'Leased', 1, 3, 0, '{}', 1, 1, ?, ?)`,
    )
    .run(taskId, runId, Date.now(), Date.now())
  database.close()
  return {
    id: taskId,
    runId,
    stage: "SeedReassessment",
    status: "Leased" as const,
    attemptCount: 1,
    maxAttempts: 3,
    input: {
      searchBrief: { reassessment: { canonicalBusinessIds } },
    },
    schemaVersion: 1,
    version: 1,
  }
}

describe("reassessment seeding", () => {
  it("carries a known business into this run and opens corroboration for it", async () => {
    const databasePath = workspace()
    const database = new Database(databasePath, { readonly: true })
    const canonicalBusinessId = database
      .prepare(
        `select rb.canonical_business_id from run_businesses rb
         join discovered_businesses d on d.id = rb.discovered_business_id
         where d.structured is not null limit 1`,
      )
      .pluck()
      .get() as string
    database.close()

    const checkpoint = await Effect.runPromise(
      makeReassessmentSeedTaskExecutor(makeSqliteDiscoveryRepository(databasePath))(
        task(databasePath, [canonicalBusinessId]),
      ),
    )

    expect(checkpoint.value).toMatchObject({ carriedBusinesses: 1, requestedBusinesses: 1 })
    expect(checkpoint.nextTasks).toHaveLength(1)
    expect(checkpoint.nextTasks?.[0]).toMatchObject({ stage: "CorroborateBusiness" })

    const seededId = checkpoint.nextTasks?.[0]?.businessId
    const checked = new Database(databasePath, { readonly: true })
    const seeded = checked
      .prepare("select run_id, source, structured from discovered_businesses where id = ?")
      .get(seededId) as { run_id: string; source: string; structured: string }
    checked.close()

    // Identity is recomputed from the carried report, so it must travel with the row.
    expect(seeded.structured.length).toBeGreaterThan(0)
    expect(seeded.source).toBe("workspace-reassessment")
  })

  it("refuses a business with no structured discovery to recompute identity from", async () => {
    const databasePath = workspace()
    const result = await Effect.runPromise(
      Effect.either(
        makeReassessmentSeedTaskExecutor(makeSqliteDiscoveryRepository(databasePath))(
          task(databasePath, ["missing-business"]),
        ),
      ),
    )
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left).toMatchObject({
        classification: "Permanent",
        code: "reassessment-not-carried",
      })
    }
  })

  it("refuses a brief that names no business", async () => {
    const databasePath = workspace()
    const result = await Effect.runPromise(
      Effect.either(
        makeReassessmentSeedTaskExecutor(makeSqliteDiscoveryRepository(databasePath))(
          task(databasePath, []),
        ),
      ),
    )
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left).toMatchObject({ code: "missing-reassessment-businesses" })
    }
  })
})
