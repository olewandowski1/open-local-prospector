import Database from "better-sqlite3"
import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  makeDiscoveryTaskExecutor,
  planDiscoveryQueries,
} from "@/features/business-discovery/application/discover-businesses"
import type { DiscoveryRuntime } from "@/features/business-discovery/application/discovery-runtime"
import type { StructuredBusiness } from "@/features/business-discovery/domain/discovery-structure"
import { makeSqliteDiscoveryRepository } from "@/features/business-discovery/infrastructure/sqlite-discovery-repository"
import type { SearchBrief } from "@/features/prospecting-runs"
import {
  type RunTask,
  runWorkerCycle,
  sqliteRunTaskRepositoryLive,
  stageExecutorLive,
  TaskExecutionError,
} from "@/features/run-execution"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("business discovery workflow", () => {
  it("bounds application-owned query plans", () => {
    const plan = planDiscoveryQueries(brief({ mode: "Thorough" }))
    const oversized = planDiscoveryQueries(
      brief({ category: "word ".repeat(100), mode: "Thorough" }),
    )
    expect(plan.queries).toHaveLength(4)
    expect(planDiscoveryQueries(brief({ mode: "Quick" })).queries).toHaveLength(2)
    expect(
      oversized.queries.every((query) => query.length <= 400 && query.split(/\s+/u).length <= 50),
    ).toBe(true)
  })

  it("keeps only what the report supports and records what it dropped", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await discoveryTask(database.path, "discovery-verified")
    const runtime = fakeRuntime(
      ["https://a.test/ tel. 111 222 333", "https://b.test/ no telephone published"].join("\n\n"),
      [
        structured("A", "https://a.test/", [
          { type: "BusinessTelephone", value: "+48111222333", sourceUrl: "https://a.test/" },
        ]),
        // Claims a telephone written beside a different business, and a source nobody reported.
        structured("B", "https://b.test/", [
          { type: "BusinessTelephone", value: "+48111222333", sourceUrl: "https://b.test/" },
        ]),
        structured("C", "https://invented.test/", []),
      ],
    )

    const checkpoint = await Effect.runPromise(
      makeDiscoveryTaskExecutor(runtime, makeSqliteDiscoveryRepository(database.path))(task),
    )

    expect(checkpoint.value.discoveredBusinesses).toBe(2)
    const contacts = readRow(
      database.path,
      "select structured from discovered_businesses where name = 'B'",
    ) as { structured: string }
    expect((JSON.parse(contacts.structured) as StructuredBusiness).contacts).toEqual([])
    expect(
      readScalar(
        database.path,
        "select count(*) from technical_run_events where kind = 'DiscoveryRejected'",
      ),
    ).toBeGreaterThanOrEqual(2)
    expect(readScalar(database.path, "select businesses_returned from discovery_reports")).toBe(3)
    expect(readScalar(database.path, "select businesses_verified from discovery_reports")).toBe(2)
  })

  it("counts one business once when two reports name it", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await discoveryTask(database.path, "discovery-duplicate", { mode: "Thorough" })
    const runtime = fakeRuntime("https://a.test/ tel. 111 222 333", [
      structured("A", "https://a.test/", [
        { type: "BusinessTelephone", value: "+48111222333", sourceUrl: "https://a.test/" },
      ]),
    ])

    const checkpoint = await Effect.runPromise(
      makeDiscoveryTaskExecutor(runtime, makeSqliteDiscoveryRepository(database.path))(task),
    )

    expect(checkpoint.value.discoveredBusinesses).toBe(1)
    expect(checkpoint.value.stoppedForRepeatedResults).toBe(true)
    expect(checkpoint.nextTasks).toHaveLength(1)
    // Two consecutive reports adding nothing new is what stops the run, so both are counted.
    expect(readScalar(database.path, "select duplicates from run_metrics")).toBe(2)
  })

  it("drives a persisted run to visible search exhaustion through the durable worker", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "worker-discovery-exhausted")
    const runtime = fakeRuntime("nothing was found", [])
    const execute = makeDiscoveryTaskExecutor(runtime, makeSqliteDiscoveryRepository(database.path))
    const workerLayer = Layer.merge(
      sqliteRunTaskRepositoryLive(database.path),
      stageExecutorLive({
        SeedReassessment: unreachableStage,
        DiscoverBusinesses: execute,
        CorroborateBusiness: unreachableStage,
        InspectWebsite: unreachableStage,
        AssessWebsiteOpportunity: unreachableStage,
        ScoreCandidate: unreachableStage,
      }),
    )
    const configuration = { concurrency: 1, leaseMilliseconds: 30_000, pollMilliseconds: 1 }

    await Effect.runPromise(
      runWorkerCycle("worker-test", configuration).pipe(Effect.provide(workerLayer)),
    )
    await Effect.runPromise(
      runWorkerCycle("worker-test", configuration).pipe(Effect.provide(workerLayer)),
    )

    expect(
      readDatabase(database.path, (sqlite) =>
        sqlite
          .prepare(
            `select state, completion_state, current_stage from prospecting_runs where id = ?`,
          )
          .get(run.id),
      ),
    ).toEqual({
      state: "Completed",
      completion_state: "Search Exhausted",
      current_stage: "DiscoverBusinesses",
    })
  })
})

function fakeRuntime(report: string, businesses: readonly StructuredBusiness[]): DiscoveryRuntime {
  return {
    identifier: "fake-discovery-runtime",
    report: vi.fn(() => Effect.succeed(report)),
    structure: vi.fn(() =>
      Effect.succeed({ schemaVersion: "discovery-structure-v1" as const, businesses }),
    ),
  }
}

function structured(
  name: string,
  url: string,
  contacts: StructuredBusiness["contacts"],
): StructuredBusiness {
  return {
    name,
    locality: "Kraków",
    decisionScope: "Local",
    centrallyControlled: false,
    onlineOnly: false,
    sourceUrls: [url],
    presences: [{ type: "Website", url }],
    contacts,
  }
}

function brief(overrides: Partial<SearchBrief> = {}): SearchBrief {
  return {
    location: "Kraków",
    category: "Dental clinics",
    targetCount: 5,
    mode: "Quick",
    runtime: "codex",
    searchArea: {
      id: "relation:276892",
      displayName: "Kraków, Polska",
      latitude: 50.0614,
      longitude: 19.9366,
      countryCode: "PL",
    },
    ...overrides,
  }
}

async function discoveryTask(
  databasePath: string,
  requestId: string,
  overrides: Partial<SearchBrief> = {},
): Promise<RunTask> {
  const run = await createTestProspectingRun(databasePath, requestId)
  const sqlite = new Database(databasePath, { fileMustExist: true })
  try {
    const row = sqlite.prepare("select id from run_tasks where run_id = ?").get(run.id) as {
      id: string
    }
    return {
      id: row.id,
      runId: run.id,
      stage: "DiscoverBusinesses",
      status: "Leased",
      attemptCount: 1,
      maxAttempts: 3,
      input: { searchBrief: brief(overrides) },
      schemaVersion: 1,
      version: 1,
    }
  } finally {
    sqlite.close()
  }
}

function readScalar(databasePath: string, query: string): number {
  return Number(readDatabase(databasePath, (database) => database.prepare(query).pluck().get()))
}

function readRow(databasePath: string, query: string): unknown {
  return readDatabase(databasePath, (database) => database.prepare(query).get())
}

function readDatabase<A>(databasePath: string, use: (database: Database.Database) => A): A {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return use(database)
  } finally {
    database.close()
  }
}

function unreachableStage(task: RunTask) {
  return Effect.fail(
    new TaskExecutionError({
      classification: "Permanent",
      code: "unexpected-stage",
      message: `This test should never reach ${task.stage}.`,
    }),
  )
}
