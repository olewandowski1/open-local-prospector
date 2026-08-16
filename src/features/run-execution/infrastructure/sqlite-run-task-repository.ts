import Database from "better-sqlite3"
import { Effect, Layer, Option } from "effect"

import {
  RunTaskPersistenceError,
  RunTaskRepository,
  type RunTaskRepositoryService,
} from "@/features/run-execution/application/run-task-repository"
import type {
  NewRunTask,
  RunTask,
  RunTaskStatus,
  StructuredTaskFailure,
  TaskCheckpoint,
} from "@/features/run-execution/domain/run-task"

type TaskRow = Readonly<{
  id: string
  run_id: string
  business_id: string | null
  stage: string
  status: RunTaskStatus
  attempt_count: number
  max_attempts: number
  lease_owner: string | null
  lease_expires_at: number | null
  input: string
  checkpoint: string | null
  schema_version: number
  version: number
}>

export const sqliteRunTaskRepositoryLive = (databasePath: string) =>
  Layer.succeed(RunTaskRepository, makeSqliteRunTaskRepository(databasePath))

export function makeSqliteRunTaskRepository(databasePath: string): RunTaskRepositoryService {
  return {
    recoverAbandoned: (now) =>
      databaseEffect(databasePath, "recover", (database) => recover(database, now)),
    claimNext: (owner, now, leaseMilliseconds) =>
      databaseEffect(databasePath, "claim", (database) =>
        claim(database, owner, now, leaseMilliseconds),
      ),
    renewLease: (taskId, owner, now, leaseMilliseconds) =>
      databaseEffect(databasePath, "renew", (database) => {
        const result = database
          .prepare(
            `update run_tasks set lease_expires_at = ?, updated_at = ?, version = version + 1
             where id = ? and status = 'Leased' and lease_owner = ?`,
          )
          .run(now.getTime() + leaseMilliseconds, now.getTime(), taskId, owner)
        if (result.changes !== 1) throw new Error("lease ownership lost")
      }),
    complete: (task, owner, checkpoint, now) =>
      databaseEffect(databasePath, "complete", (database) =>
        complete(database, task, owner, checkpoint, now),
      ),
    fail: (task, owner, failure, now) =>
      databaseEffect(databasePath, "fail", (database) => fail(database, task, owner, failure, now)),
  }
}

function databaseEffect<A>(
  databasePath: string,
  operation: RunTaskPersistenceError["operation"],
  use: (database: Database.Database) => A,
) {
  return Effect.try({
    try: () => {
      const database = new Database(databasePath, { fileMustExist: true })
      database.pragma("foreign_keys = ON")
      database.pragma("busy_timeout = 5000")
      try {
        return use(database)
      } finally {
        database.close()
      }
    },
    catch: () => new RunTaskPersistenceError({ operation }),
  })
}

function recover(database: Database.Database, now: Date): number {
  return database.transaction(() => {
    const abandoned = database
      .prepare(
        `select id, run_id from run_tasks
         where status = 'Leased' and lease_expires_at is not null and lease_expires_at <= ?`,
      )
      .all(now.getTime()) as readonly { id: string; run_id: string }[]
    const update = database.prepare(
      `update run_tasks set status = 'Pending', lease_owner = null, lease_expires_at = null,
       available_at = ?, updated_at = ?, version = version + 1 where id = ? and status = 'Leased'`,
    )
    for (const task of abandoned) {
      update.run(now.getTime(), now.getTime(), task.id)
      transition(database, task.run_id, task.id, "Leased", "Pending", "LeaseRecovered", {}, now)
    }
    return abandoned.length
  })()
}

function claim(
  database: Database.Database,
  owner: string,
  now: Date,
  leaseMilliseconds: number,
): Option.Option<RunTask> {
  return database.transaction(() => {
    const candidate = database
      .prepare(
        `select * from run_tasks where status = 'Pending' and available_at <= ?
         order by created_at, id limit 1`,
      )
      .get(now.getTime()) as TaskRow | undefined
    if (!candidate) return Option.none()
    const update = database
      .prepare(
        `update run_tasks set status = 'Leased', attempt_count = attempt_count + 1,
         lease_owner = ?, lease_expires_at = ?, updated_at = ?, version = version + 1
         where id = ? and status = 'Pending' and version = ?`,
      )
      .run(owner, now.getTime() + leaseMilliseconds, now.getTime(), candidate.id, candidate.version)
    if (update.changes !== 1) return Option.none()
    database
      .prepare(
        `update prospecting_runs set state = 'Running', current_stage = ?, updated_at = ?,
         version = version + 1 where id = ?`,
      )
      .run(candidate.stage, now.getTime(), candidate.run_id)
    transition(
      database,
      candidate.run_id,
      candidate.id,
      "Pending",
      "Leased",
      "TaskClaimed",
      { owner },
      now,
    )
    return Option.some(
      mapTask({
        ...candidate,
        status: "Leased",
        attempt_count: candidate.attempt_count + 1,
        lease_owner: owner,
        lease_expires_at: now.getTime() + leaseMilliseconds,
        version: candidate.version + 1,
      }),
    )
  })()
}

function complete(
  database: Database.Database,
  task: RunTask,
  owner: string,
  checkpoint: TaskCheckpoint,
  now: Date,
): void {
  database.transaction(() => {
    const update = database
      .prepare(
        `update run_tasks set status = 'Completed', checkpoint = ?, failure = null,
         lease_owner = null, lease_expires_at = null, updated_at = ?, version = version + 1
         where id = ? and status = 'Leased' and lease_owner = ?`,
      )
      .run(JSON.stringify(checkpoint.value), now.getTime(), task.id, owner)
    if (update.changes !== 1) throw new Error("lease ownership lost")
    transition(
      database,
      task.runId,
      task.id,
      "Leased",
      "Completed",
      "CheckpointCommitted",
      checkpoint.value,
      now,
    )
    for (const nextTask of checkpoint.nextTasks ?? [])
      insertTask(database, task.runId, nextTask, now)
    updateRunAfterSettledTask(database, task.runId, task.stage, now)
  })()
}

function fail(
  database: Database.Database,
  task: RunTask,
  owner: string,
  failure: StructuredTaskFailure,
  now: Date,
): void {
  database.transaction(() => {
    const retry = failure.classification === "Transient" && task.attemptCount < task.maxAttempts
    const nextStatus: RunTaskStatus = retry
      ? "Pending"
      : failure.classification === "Blocked" || failure.classification === "Infrastructure"
        ? "Blocked"
        : failure.classification === "Cancelled"
          ? "Cancelled"
          : "FailedPermanent"
    const update = database
      .prepare(
        `update run_tasks set status = ?, failure = ?, lease_owner = null, lease_expires_at = null,
         available_at = ?, updated_at = ?, version = version + 1
         where id = ? and status = 'Leased' and lease_owner = ?`,
      )
      .run(
        nextStatus,
        JSON.stringify(failure),
        retry ? now.getTime() + 250 : now.getTime(),
        now.getTime(),
        task.id,
        owner,
      )
    if (update.changes !== 1) throw new Error("lease ownership lost")
    transition(database, task.runId, task.id, "Leased", nextStatus, "TaskFailed", failure, now)
    updateRunAfterSettledTask(database, task.runId, task.stage, now)
  })()
}

function insertTask(database: Database.Database, runId: string, task: NewRunTask, now: Date): void {
  const id = crypto.randomUUID()
  database
    .prepare(
      `insert into run_tasks
       (id, run_id, business_id, stage, status, attempt_count, max_attempts, available_at,
        input, schema_version, version, created_at, updated_at)
       values (?, ?, ?, ?, 'Pending', 0, 3, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      id,
      runId,
      task.businessId ?? null,
      task.stage,
      now.getTime(),
      JSON.stringify(task.input ?? {}),
      task.schemaVersion ?? 1,
      now.getTime(),
      now.getTime(),
    )
}

function updateRunAfterSettledTask(
  database: Database.Database,
  runId: string,
  stage: string,
  now: Date,
): void {
  const counts = database
    .prepare(
      `select
       sum(case when status in ('Pending', 'Leased') then 1 else 0 end) as active,
       sum(case when status = 'Blocked' then 1 else 0 end) as blocked,
       sum(case when status = 'FailedPermanent' then 1 else 0 end) as failed,
       sum(case when status = 'Cancelled' then 1 else 0 end) as cancelled
       from run_tasks where run_id = ?`,
    )
    .get(runId) as { active: number; blocked: number; failed: number; cancelled: number }
  if (counts.active > 0) return

  const outcome =
    counts.blocked > 0
      ? { state: "Paused", completion: "Runtime Unavailable" }
      : counts.cancelled > 0
        ? { state: "Cancelled", completion: "Cancelled with Partial Results" }
        : counts.failed > 0
          ? { state: "Completed", completion: "Completed with Warnings" }
          : { state: "Completed", completion: "Search Exhausted" }
  database
    .prepare(
      `update prospecting_runs set state = ?, completion_state = ?, current_stage = ?,
       updated_at = ?, version = version + 1 where id = ?`,
    )
    .run(outcome.state, outcome.completion, stage, now.getTime(), runId)
  transition(database, runId, null, null, outcome.state, "RunSettled", outcome, now)
}

function transition(
  database: Database.Database,
  runId: string,
  taskId: string | null,
  fromState: string | null,
  toState: string,
  event: string,
  payload: Readonly<Record<string, unknown>>,
  now: Date,
): void {
  database
    .prepare(
      `insert into run_transitions
       (id, run_id, task_id, from_state, to_state, event, payload, schema_version, created_at)
       values (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      crypto.randomUUID(),
      runId,
      taskId,
      fromState,
      toState,
      event,
      JSON.stringify(payload),
      now.getTime(),
    )
}

function mapTask(row: TaskRow): RunTask {
  return {
    id: row.id,
    runId: row.run_id,
    ...(row.business_id ? { businessId: row.business_id } : {}),
    stage: row.stage,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    ...(row.lease_owner ? { leaseOwner: row.lease_owner } : {}),
    ...(row.lease_expires_at ? { leaseExpiresAt: new Date(row.lease_expires_at) } : {}),
    input: JSON.parse(row.input) as Readonly<Record<string, unknown>>,
    ...(row.checkpoint
      ? { checkpoint: JSON.parse(row.checkpoint) as Readonly<Record<string, unknown>> }
      : {}),
    schemaVersion: row.schema_version,
    version: row.version,
  }
}
