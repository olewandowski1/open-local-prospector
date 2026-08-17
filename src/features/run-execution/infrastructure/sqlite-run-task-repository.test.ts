import Database from "better-sqlite3"
import { Effect, Option } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import type { RunTask, StructuredTaskFailure } from "@/features/run-execution/domain/run-task"
import { makeSqliteRunTaskRepository } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("SQLite durable task repository", () => {
  it("reopens a prematurely completed run that still has pending tasks", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "reopen-run")
    const connection = new Database(database.path)
    try {
      connection
        .prepare(
          "update prospecting_runs set state='Completed', completion_state='Search Exhausted' where id=?",
        )
        .run(run.id)
    } finally {
      connection.close()
    }

    const repository = makeSqliteRunTaskRepository(database.path)
    await Effect.runPromise(repository.recoverAbandoned(new Date()))

    expect(
      readRow(
        database.path,
        "select state, completion_state from prospecting_runs where id = ?",
        run.id,
      ),
    ).toEqual({ state: "Running", completion_state: null })
    expect(
      Option.isSome(await Effect.runPromise(repository.claimNext("worker", new Date(), 10_000))),
    ).toBe(true)
  })

  it("settles as target reached only after the last task completes", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "target-run")
    const connection = new Database(database.path)
    try {
      connection.prepare("update run_metrics set target_remaining=0 where run_id=?").run(run.id)
    } finally {
      connection.close()
    }
    const repository = makeSqliteRunTaskRepository(database.path)
    const task = requiredTask(
      await Effect.runPromise(repository.claimNext("worker", new Date(), 10_000)),
    )
    await Effect.runPromise(
      repository.complete(task, "worker", { value: { done: true } }, new Date()),
    )

    expect(
      readRow(
        database.path,
        "select state, completion_state from prospecting_runs where id = ?",
        run.id,
      ),
    ).toEqual({ state: "Completed", completion_state: "Target Reached" })
  })

  it("recovers an abandoned lease without repeating a completed checkpoint", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "restart-run")
    const repository = makeSqliteRunTaskRepository(database.path)
    const startedAt = new Date(Date.now() + 1_000)

    const planning = requiredTask(
      await Effect.runPromise(repository.claimNext("worker-a", startedAt, 1_000)),
    )
    await Effect.runPromise(
      repository.complete(
        planning,
        "worker-a",
        {
          value: { planned: true, schemaVersion: 1 },
          nextTasks: [{ stage: "DiscoverBusinesses", input: planning.input }],
        },
        new Date(startedAt.getTime() + 100),
      ),
    )
    const discovery = requiredTask(
      await Effect.runPromise(
        repository.claimNext("worker-a", new Date(startedAt.getTime() + 200), 1_000),
      ),
    )

    expect(
      await Effect.runPromise(repository.recoverAbandoned(new Date(startedAt.getTime() + 1_100))),
    ).toBe(0)
    expect(
      await Effect.runPromise(repository.recoverAbandoned(new Date(startedAt.getTime() + 1_201))),
    ).toBe(1)
    const resumed = requiredTask(
      await Effect.runPromise(
        repository.claimNext("worker-b", new Date(startedAt.getTime() + 1_202), 1_000),
      ),
    )

    expect(resumed.id).toBe(discovery.id)
    expect(resumed.attemptCount).toBe(2)
    const completedPlanning = readRow(
      database.path,
      "select status, attempt_count, checkpoint from run_tasks where run_id = ? and stage = 'RunPlanning'",
      run.id,
    )
    expect(completedPlanning).toMatchObject({ status: "Completed", attempt_count: 1 })
    expect(completedPlanning?.checkpoint).toContain('"planned":true')
  })

  it("retries transient work at most twice and leaves unrelated work visible", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "retry-run")
    const repository = makeSqliteRunTaskRepository(database.path)
    const startedAt = new Date(Date.now() + 1_000)
    const planning = requiredTask(
      await Effect.runPromise(repository.claimNext("worker", startedAt, 10_000)),
    )
    await Effect.runPromise(
      repository.complete(
        planning,
        "worker",
        {
          value: { planned: true },
          nextTasks: [
            { stage: "InspectBusiness", businessId: "business-a" },
            { stage: "InspectBusiness", businessId: "business-b" },
          ],
        },
        startedAt,
      ),
    )

    const transient = failure("Transient", "temporary-network")
    const first = requiredTask(
      await Effect.runPromise(repository.claimNext("worker", startedAt, 10_000)),
    )
    await Effect.runPromise(repository.fail(first, "worker", transient, startedAt))
    const unrelated = requiredTask(
      await Effect.runPromise(repository.claimNext("worker", startedAt, 10_000)),
    )
    await Effect.runPromise(
      repository.fail(unrelated, "worker", failure("Permanent", "robots-block"), startedAt),
    )
    const second = requiredTask(
      await Effect.runPromise(
        repository.claimNext("worker", new Date(startedAt.getTime() + 251), 10_000),
      ),
    )
    await Effect.runPromise(
      repository.fail(second, "worker", transient, new Date(startedAt.getTime() + 251)),
    )
    const third = requiredTask(
      await Effect.runPromise(
        repository.claimNext("worker", new Date(startedAt.getTime() + 502), 10_000),
      ),
    )
    await Effect.runPromise(
      repository.fail(third, "worker", transient, new Date(startedAt.getTime() + 502)),
    )

    expect(third.attemptCount).toBe(3)
    const businessTasks = readRows(
      database.path,
      "select business_id, status, attempt_count, failure from run_tasks where run_id = ? and business_id is not null",
      run.id,
    )
    expect(businessTasks).toHaveLength(2)
    expect(businessTasks.find((task) => task.business_id === first.businessId)).toMatchObject({
      status: "FailedPermanent",
      attempt_count: 3,
    })
    expect(businessTasks.find((task) => task.business_id === unrelated.businessId)).toMatchObject({
      status: "FailedPermanent",
      attempt_count: 1,
    })
    expect(
      readRow(
        database.path,
        "select state, completion_state from prospecting_runs where id = ?",
        run.id,
      ),
    ).toEqual({ state: "Completed", completion_state: "Completed with Warnings" })
  })
})

function requiredTask(value: Option.Option<RunTask>): RunTask {
  const task = Option.getOrUndefined(value)
  if (!task) throw new Error("Expected a claimed task")
  return task
}

function failure(
  classification: StructuredTaskFailure["classification"],
  code: string,
): StructuredTaskFailure {
  return { classification, code, message: code, occurredAt: "2026-08-16T11:00:00.000Z" }
}

function readRow(
  databasePath: string,
  query: string,
  parameter: string,
): Record<string, unknown> | undefined {
  return readRows(databasePath, query, parameter)[0]
}

function readRows(
  databasePath: string,
  query: string,
  parameter: string,
): Record<string, unknown>[] {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return database.prepare(query).all(parameter) as Record<string, unknown>[]
  } finally {
    database.close()
  }
}
