import Database from "better-sqlite3"
import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import { StageExecutor } from "@/features/run-execution/application/stage-executor"
import {
  loadWorkerConfiguration,
  runWorkerCycle,
} from "@/features/run-execution/application/worker"
import { sqliteRunTaskRepositoryLive } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("durable run worker", () => {
  it("defaults business concurrency to two", () => {
    expect(loadWorkerConfiguration({}).concurrency).toBe(2)
  })

  it.each([1, 2, 4])("accepts business concurrency %i", (concurrency) => {
    expect(
      loadWorkerConfiguration({ PROSPECTOR_BUSINESS_CONCURRENCY: String(concurrency) }).concurrency,
    ).toBe(concurrency)
  })

  it.each(["0", "5", "1.5", "many"])("rejects business concurrency %s", (concurrency) => {
    expect(() => loadWorkerConfiguration({ PROSPECTOR_BUSINESS_CONCURRENCY: concurrency })).toThrow(
      /1 through 4/u,
    )
  })

  it("executes a claimed task after the claim transaction has closed", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    await createTestProspectingRun(database.path, "worker-cycle")
    const executor = Layer.succeed(StageExecutor, {
      execute: (task) =>
        Effect.sync(() => {
          const sqlite = new Database(database.path, { fileMustExist: true })
          try {
            sqlite
              .prepare("update prospecting_runs set updated_at = ? where id = ?")
              .run(Date.now(), task.runId)
          } finally {
            sqlite.close()
          }
          return { value: { planned: true } }
        }),
    })
    const claimed = await Effect.runPromise(
      runWorkerCycle("worker-a", {
        concurrency: 2,
        leaseMilliseconds: 30_000,
        pollMilliseconds: 1,
      }).pipe(Effect.provide(Layer.merge(sqliteRunTaskRepositoryLive(database.path), executor))),
    )

    expect(claimed).toBe(1)
    expect(
      readScalar(database.path, "select count(*) from run_tasks where status = 'Completed'"),
    ).toBe(1)
  })
})

function readScalar(databasePath: string, query: string): number {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return Number(database.prepare(query).pluck().get())
  } finally {
    database.close()
  }
}
