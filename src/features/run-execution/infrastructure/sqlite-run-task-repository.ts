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
    database
      .prepare(
        `update run_metrics set target_remaining=max(0,
         (select json_extract(search_brief,'$.targetCount') from prospecting_runs where id=run_id) -
         qualified_candidates), updated_at=?, version=version+1`,
      )
      .run(now.getTime())
    database
      .prepare(
        `update prospecting_runs set completion_state='Search Exhausted', updated_at=?, version=version+1
         where state='Completed' and completion_state='Target Reached'
         and exists(select 1 from run_metrics where run_id=prospecting_runs.id and target_remaining>0)`,
      )
      .run(now.getTime())
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
    const incorrectlySettled = database
      .prepare(
        `select distinct r.id from prospecting_runs r join run_tasks t on t.run_id = r.id
         where r.state = 'Completed' and t.status in ('Pending', 'Leased')`,
      )
      .all() as readonly { id: string }[]
    const reopen = database.prepare(
      `update prospecting_runs set state = 'Running', completion_state = null,
       updated_at = ?, version = version + 1 where id = ? and state = 'Completed'`,
    )
    for (const run of incorrectlySettled) {
      reopen.run(now.getTime(), run.id)
      transition(database, run.id, null, "Completed", "Running", "RunReopened", {}, now)
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
        `select t.* from run_tasks t join prospecting_runs r on r.id = t.run_id
         where t.status = 'Pending' and t.available_at <= ? and r.requested_control = 'None'
         and r.state not in ('Completed', 'Cancelled') order by t.created_at, t.id limit 1`,
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
    const requestedControl = database
      .prepare("select requested_control from prospecting_runs where id = ?")
      .pluck()
      .get(task.runId)
    if (requestedControl !== "Cancel") {
      for (const nextTask of checkpoint.nextTasks ?? []) {
        insertTask(database, task.runId, nextTask, now)
      }
    }
    if (checkpoint.completionState && (checkpoint.nextTasks?.length ?? 0) === 0) {
      database
        .prepare(
          `update prospecting_runs set state = 'Completed', completion_state = ?, current_stage = ?,
           updated_at = ?, version = version + 1 where id = ?`,
        )
        .run(checkpoint.completionState, task.stage, now.getTime(), task.runId)
      transition(
        database,
        task.runId,
        null,
        null,
        "Completed",
        "RunSettled",
        { state: "Completed", completion: checkpoint.completionState },
        now,
      )
      return
    }
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
      : failure.classification === "Blocked"
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
       sum(case when status = 'Cancelled' then 1 else 0 end) as cancelled,
       sum(case when status = 'Leased' then 1 else 0 end) as leased,
       sum(case when status = 'FailedPermanent' and business_id is null
         and json_extract(failure, '$.classification') = 'Infrastructure' then 1 else 0 end) as infrastructure
       from run_tasks where run_id = ?`,
    )
    .get(runId) as {
    active: number
    blocked: number
    failed: number
    cancelled: number
    leased: number
    infrastructure: number
  }
  const requestedControl = database
    .prepare("select requested_control from prospecting_runs where id = ?")
    .pluck()
    .get(runId)
  if (requestedControl === "Pause" && counts.leased === 0) {
    database
      .prepare(
        `update prospecting_runs set state = 'Paused', completion_state = 'Paused',
         updated_at = ?, version = version + 1 where id = ?`,
      )
      .run(now.getTime(), runId)
    transition(database, runId, null, null, "Paused", "RunPaused", {}, now)
    return
  }
  if (requestedControl === "Cancel" && counts.leased === 0) {
    database
      .prepare(
        `update prospecting_runs set state = 'Cancelled',
         completion_state = 'Cancelled with Partial Results', updated_at = ?,
         version = version + 1 where id = ?`,
      )
      .run(now.getTime(), runId)
    transition(database, runId, null, null, "Cancelled", "RunCancelled", {}, now)
    return
  }
  if (counts.active > 0) return

  const targetRemaining = database
    .prepare("select target_remaining from run_metrics where run_id = ?")
    .pluck()
    .get(runId) as number | undefined

  const outcome =
    counts.infrastructure > 0
      ? { state: "Completed", completion: "Infrastructure Failed" }
      : counts.blocked > 0
        ? { state: "Paused", completion: "Runtime Unavailable" }
        : counts.cancelled > 0
          ? { state: "Cancelled", completion: "Cancelled with Partial Results" }
          : counts.failed > 0
            ? { state: "Completed", completion: "Completed with Warnings" }
            : {
                state: "Completed",
                completion: targetRemaining === 0 ? "Target Reached" : "Search Exhausted",
              }
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
