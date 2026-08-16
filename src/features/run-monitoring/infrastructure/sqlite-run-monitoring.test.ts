import Database from "better-sqlite3"
import { Effect, Option } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import {
  controlRun,
  getRun,
  listRuns,
} from "@/features/run-monitoring/application/run-repositories"
import { sqliteRunMonitoringLive } from "@/features/run-monitoring/infrastructure/sqlite-run-monitoring"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"
import { makeSqliteRunTaskRepository, type RunTask } from "@/test-support/run-task"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("SQLite run monitoring", () => {
  it("reads every progress count and keeps source events in the Technical Run Log", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "monitor-run")
    const sqlite = new Database(database.path, { fileMustExist: true })
    try {
      sqlite
        .prepare(
          `update run_metrics set queries = 2, discoveries = 8, duplicates = 1, exclusions = 2,
           websites = 4, assessments = 3, qualified_candidates = 2, blocked_inspections = 1,
           target_remaining = 3, version = version + 1 where run_id = ?`,
        )
        .run(run.id)
      sqlite
        .prepare(
          `insert into technical_run_events
           (id, run_id, kind, source_identifier, result_url, message, details, schema_version, created_at)
           values (?, ?, 'DiscoveryResult', 'brave-search', 'https://example.com/result',
             'A public result URL was returned.', '{}', 1, ?)`,
        )
        .run(crypto.randomUUID(), run.id, Date.now())
    } finally {
      sqlite.close()
    }
    const layer = sqliteRunMonitoringLive(database.path)
    const summaries = await Effect.runPromise(listRuns.pipe(Effect.provide(layer)))
    const detail = await Effect.runPromise(getRun(run.id).pipe(Effect.provide(layer)))

    expect(summaries[0]?.progress).toEqual({
      queries: 2,
      discoveries: 8,
      duplicates: 1,
      exclusions: 2,
      websites: 4,
      assessments: 3,
      qualifiedCandidates: 2,
      blockedInspections: 1,
      targetRemaining: 3,
    })
    expect(detail.technicalLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "DiscoveryResult",
          sourceIdentifier: "brave-search",
          resultUrl: "https://example.com/result",
        }),
      ]),
    )
    expect(JSON.stringify(detail)).not.toContain("chain-of-thought")
  })

  it("pauses after the active atomic step, resumes pending checkpoints, and cancels without new work", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "control-run")
    const tasks = makeSqliteRunTaskRepository(database.path)
    const monitoring = sqliteRunMonitoringLive(database.path)
    const now = new Date(Date.now() + 1_000)
    const planning = requiredTask(await Effect.runPromise(tasks.claimNext("worker", now, 30_000)))

    await Effect.runPromise(controlRun(run.id, "Pause").pipe(Effect.provide(monitoring)))
    expect((await readDetail(database.path, run.id)).state).toBe("Pausing")
    await Effect.runPromise(
      tasks.complete(
        planning,
        "worker",
        {
          value: { planned: true },
          nextTasks: [{ stage: "DiscoverBusinesses", input: planning.input }],
        },
        new Date(now.getTime() + 10),
      ),
    )
    const paused = await readDetail(database.path, run.id)
    expect(paused).toMatchObject({ state: "Paused", completionState: "Paused" })
    expect(Option.isNone(await Effect.runPromise(tasks.claimNext("other", now, 30_000)))).toBe(true)

    await Effect.runPromise(controlRun(run.id, "Resume").pipe(Effect.provide(monitoring)))
    const discovery = requiredTask(
      await Effect.runPromise(tasks.claimNext("worker", new Date(now.getTime() + 20), 30_000)),
    )
    await Effect.runPromise(controlRun(run.id, "Cancel").pipe(Effect.provide(monitoring)))
    expect((await readDetail(database.path, run.id)).state).toBe("Cancelling")
    await Effect.runPromise(
      tasks.complete(
        discovery,
        "worker",
        {
          value: { discovered: 1 },
          nextTasks: [{ stage: "ShouldNotBeCreated" }],
        },
        new Date(now.getTime() + 30),
      ),
    )

    const cancelled = await readDetail(database.path, run.id)
    expect(cancelled).toMatchObject({
      state: "Cancelled",
      completionState: "Cancelled with Partial Results",
    })
    expect(Option.isNone(await Effect.runPromise(tasks.claimNext("other", now, 30_000)))).toBe(true)
    expect(
      readScalar(
        database.path,
        "select count(*) from run_tasks where run_id = ? and status = 'Completed'",
        run.id,
      ),
    ).toBe(2)
    expect(
      readScalar(
        database.path,
        "select count(*) from run_tasks where run_id = ? and stage = 'ShouldNotBeCreated'",
        run.id,
      ),
    ).toBe(0)
  })

  it("settles one business infrastructure failure as warnings, not Infrastructure Failed", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "business-failure")
    const tasks = makeSqliteRunTaskRepository(database.path)
    const now = new Date(Date.now() + 1_000)
    const planning = requiredTask(await Effect.runPromise(tasks.claimNext("worker", now, 30_000)))
    await Effect.runPromise(
      tasks.complete(
        planning,
        "worker",
        {
          value: { planned: true },
          nextTasks: [{ stage: "InspectBusiness", businessId: "business-a" }],
        },
        now,
      ),
    )
    const business = requiredTask(await Effect.runPromise(tasks.claimNext("worker", now, 30_000)))
    await Effect.runPromise(
      tasks.fail(
        business,
        "worker",
        {
          classification: "Infrastructure",
          code: "browser-crashed",
          message: "The isolated browser process exited.",
          occurredAt: now.toISOString(),
        },
        now,
      ),
    )

    expect(await readDetail(database.path, run.id)).toMatchObject({
      state: "Completed",
      completionState: "Completed with Warnings",
      businesses: [
        expect.objectContaining({
          id: "business-a",
          status: "FailedPermanent",
          failureReason: "The isolated browser process exited.",
        }),
      ],
    })
  })
})

function requiredTask(value: Option.Option<RunTask>): RunTask {
  const task = Option.getOrUndefined(value)
  if (!task) throw new Error("Expected task")
  return task
}

function readDetail(databasePath: string, runId: string) {
  return Effect.runPromise(
    getRun(runId).pipe(Effect.provide(sqliteRunMonitoringLive(databasePath))),
  )
}

function readScalar(databasePath: string, query: string, parameter: string): number {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return Number(database.prepare(query).pluck().get(parameter))
  } finally {
    database.close()
  }
}
