import Database from "better-sqlite3"
import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  makeDiscoveryTaskExecutor,
  planDiscoveryQueries,
} from "@/features/business-discovery/application/discover-businesses"
import type { DiscoverySource } from "@/features/business-discovery/application/discovery-source"
import type { DiscoveryResult } from "@/features/business-discovery/domain/discovered-business"
import { makeSqliteDiscoveryRepository } from "@/features/business-discovery/infrastructure/sqlite-discovery-repository"
import type { SearchBrief } from "@/features/prospecting-runs"
import {
  type RunTask,
  runWorkerCycle,
  sqliteRunTaskRepositoryLive,
  stageExecutorLive,
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
    expect(plan.queries).toHaveLength(8)
    expect(plan.pagesPerQuery).toBe(1)
    expect(
      oversized.queries.every((query) => query.length <= 400 && query.split(/\s+/u).length <= 50),
    ).toBe(true)
  })

  it("persists source history, duplicate inputs, exhaustion, and progress", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await discoveryTask(database.path, "discovery-exhausted")
    const pages = [[result("A"), result("B")], [result("A"), result("C")], [result("C")], []]
    const search = vi.fn<DiscoverySource["search"]>((_request) =>
      Effect.succeed({ results: pages.shift() ?? [], moreResults: false }),
    )
    const execute = makeDiscoveryTaskExecutor(
      { identifier: "fake-runtime-search", search },
      makeSqliteDiscoveryRepository(database.path),
    )

    const checkpoint = await Effect.runPromise(execute(task))
    const repeated = await Effect.runPromise(execute(task))

    expect(checkpoint).toMatchObject({
      completionState: "Search Exhausted",
      value: { discoveredBusinesses: 3, targetReached: false, searchExhausted: true },
    })
    expect(repeated).toMatchObject({ completionState: "Search Exhausted" })
    expect(search).toHaveBeenCalledTimes(4)
    expect(
      readRow(
        database.path,
        "select queries, discoveries, duplicates, target_remaining from run_metrics",
      ),
    ).toEqual({
      queries: 4,
      discoveries: 3,
      duplicates: 2,
      target_remaining: 2,
    })
    expect(readScalar(database.path, "select count(*) from discovery_occurrences")).toBe(5)
    expect(
      readScalar(
        database.path,
        "select count(*) from discovery_occurrences where duplicate_input = 1",
      ),
    ).toBe(2)
    expect(
      readScalar(
        database.path,
        "select count(*) from technical_run_events where kind = 'DiscoveryQuery'",
      ),
    ).toBe(4)
    const raw = readRow(
      database.path,
      "select raw_attributes from discovered_businesses order by name limit 1",
    ) as { raw_attributes: string }
    expect(JSON.parse(raw.raw_attributes)).toEqual({ title: "A", url: "https://example.test/a" })
  })

  it("uses bounded query variants and stops as soon as the requested target is reached", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await discoveryTask(database.path, "discovery-target", { mode: "Thorough" })
    const pages = [[result("A"), result("B")], [result("C"), result("D")], [result("E")]]
    const search = vi.fn<DiscoverySource["search"]>(() =>
      Effect.succeed({ results: pages.shift() ?? [], moreResults: false }),
    )

    const checkpoint = await Effect.runPromise(
      makeDiscoveryTaskExecutor(
        { identifier: "fake-runtime-search", search },
        makeSqliteDiscoveryRepository(database.path),
      )(task),
    )

    expect(search.mock.calls.map(([request]) => request.offset)).toEqual([0, 0, 0])
    expect(checkpoint.completionState).toBeUndefined()
    expect(checkpoint.nextTasks).toHaveLength(5)
    expect(new Set(checkpoint.nextTasks?.map((next) => next.businessId)).size).toBe(5)
    expect(
      readRow(database.path, "select queries, discoveries, target_remaining from run_metrics"),
    ).toEqual({
      queries: 3,
      discoveries: 5,
      target_remaining: 0,
    })
  })

  it("drives a persisted run to visible search exhaustion through the durable worker", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "worker-discovery-exhausted")
    const search = vi.fn<DiscoverySource["search"]>(() =>
      Effect.succeed({ results: [], moreResults: false }),
    )
    const execute = makeDiscoveryTaskExecutor(
      { identifier: "fake-runtime-search", search },
      makeSqliteDiscoveryRepository(database.path),
    )
    const workerLayer = Layer.merge(
      sqliteRunTaskRepositoryLive(database.path),
      stageExecutorLive(execute),
    )
    const configuration = { concurrency: 1, leaseMilliseconds: 30_000, pollMilliseconds: 1 }

    await Effect.runPromise(
      runWorkerCycle("worker-test", configuration).pipe(Effect.provide(workerLayer)),
    )
    await Effect.runPromise(
      runWorkerCycle("worker-test", configuration).pipe(Effect.provide(workerLayer)),
    )

    expect(search).toHaveBeenCalledTimes(3)
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
    expect(
      readScalar(database.path, "select count(*) from run_tasks where status = 'Completed'"),
    ).toBe(2)
  })
})

function result(name: string): DiscoveryResult {
  const url = `https://example.test/${name.toLowerCase()}`
  return { sourceIdentifier: `web:${url}`, title: name, url, attributes: { title: name, url } }
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
