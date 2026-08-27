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

function task(databasePath: string, discoveredBusinessIds: readonly string[]) {
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
      searchBrief: { reassessment: { discoveredBusinessIds } },
    },
    schemaVersion: 1,
    version: 1,
  }
}

describe("reassessment seeding", () => {
  it("carries a known business into this run and opens corroboration for it", async () => {
    const databasePath = workspace()
    const database = new Database(databasePath, { readonly: true })
    const discoveredBusinessId = database
      .prepare("select id from discovered_businesses where structured is not null limit 1")
      .pluck()
      .get() as string
    database.close()

    const checkpoint = await Effect.runPromise(
      makeReassessmentSeedTaskExecutor(makeSqliteDiscoveryRepository(databasePath))(
        task(databasePath, [discoveredBusinessId]),
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

  it("repeats the named record even when the business was listed again more thinly", async () => {
    const databasePath = workspace()
    const database = new Database(databasePath)
    const original = database
      .prepare(
        `select d.id, d.run_id, d.name, rb.canonical_business_id from discovered_businesses d
         join run_businesses rb on rb.discovered_business_id = d.id
         where d.structured is not null and rb.canonical_business_id is not null limit 1`,
      )
      .get() as { id: string; run_id: string; name: string; canonical_business_id: string }
    // A later, thinner listing of the same business must not be the one repeated.
    const thinner = crypto.randomUUID()
    database
      .prepare(
        `insert into discovered_businesses
         (id, run_id, source, source_identifier, discovery_key, name, normalized_name,
          result_url, description, raw_attributes, structured, discovery_rank, discovered_at)
         values (?, ?, 'subscription-runtime-search-then-structure', 'later', 'later-key', ?, ?,
          'https://later.test/', null, '{}', ?, 99, ?)`,
      )
      .run(
        thinner,
        original.run_id,
        original.name,
        original.name.toLowerCase(),
        JSON.stringify({ name: original.name, locality: "Nowhere" }),
        Date.now() + 60_000,
      )
    database
      .prepare(
        `insert into run_businesses
         (id, run_id, discovered_business_id, canonical_business_id, status, identity_confidence,
          signals, created_at, updated_at)
         values (?, ?, ?, ?, 'Eligible', 'Corroborated', '{}', ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        original.run_id,
        thinner,
        original.canonical_business_id,
        Date.now(),
        Date.now(),
      )
    database.close()

    const checkpoint = await Effect.runPromise(
      makeReassessmentSeedTaskExecutor(makeSqliteDiscoveryRepository(databasePath))(
        task(databasePath, [original.id]),
      ),
    )

    const checked = new Database(databasePath, { readonly: true })
    const carried = checked
      .prepare("select source_identifier, structured from discovered_businesses where id = ?")
      .get(checkpoint.nextTasks?.[0]?.businessId) as {
      source_identifier: string
      structured: string
    }
    checked.close()

    expect(carried.source_identifier).toBe(original.id)
    expect(carried.structured).not.toContain("Nowhere")
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
