import type Database from "better-sqlite3"
import { Effect, Layer } from "effect"
import { sharedDatabase } from "@/features/local-application"
import type { RuntimeId, SearchBrief } from "@/features/prospecting-runs"

import {
  type RunControl,
  RunControlRepository,
  RunMonitoringError,
  RunReadRepository,
} from "@/features/run-monitoring/application/run-repositories"
import {
  type BusinessProgress,
  type RunCompletionState,
  type RunDetail,
  type RunProgressCounts,
  type RunSummary,
  runCompletionStates,
  type TechnicalRunEvent,
} from "@/features/run-monitoring/domain/run-progress"

type RunRow = Readonly<{
  id: string
  state: string
  completion_state: string | null
  current_stage: string | null
  requested_control: string
  search_brief: string
  version: number
  created_at: number
  updated_at: number
  queries: number
  discoveries: number
  duplicates: number
  exclusions: number
  websites: number
  assessments: number
  qualified_candidates: number
  blocked_inspections: number
  target_remaining: number
}>

export const sqliteRunMonitoringLive = (databasePath: string) =>
  Layer.merge(
    Layer.succeed(RunReadRepository, {
      list: readEffect(databasePath, "list", (database) => list(database)),
      get: (runId) => readEffect(databasePath, "read", (database) => get(database, runId)),
    }),
    Layer.succeed(RunControlRepository, {
      request: (runId, control, runtime) =>
        writeEffect(databasePath, (database) => requestControl(database, runId, control, runtime)),
    }),
  )

function readEffect<A>(
  databasePath: string,
  operation: "list" | "read",
  use: (database: Database.Database) => A,
) {
  return Effect.try({
    try: () => withDatabase(databasePath, true, use),
    catch: () => new RunMonitoringError({ operation }),
  })
}

function writeEffect(databasePath: string, use: (database: Database.Database) => void) {
  return Effect.try({
    try: () => withDatabase(databasePath, false, use),
    catch: () => new RunMonitoringError({ operation: "control" }),
  })
}

function withDatabase<A>(
  databasePath: string,
  readonly: boolean,
  use: (database: Database.Database) => A,
): A {
  return use(sharedDatabase(databasePath, readonly))
}

const runSelect = `
  select r.id, r.state, r.completion_state, r.current_stage, r.requested_control,
    r.search_brief, r.version, r.created_at, r.updated_at,
    coalesce(m.queries, 0) as queries, coalesce(m.discoveries, 0) as discoveries,
    coalesce(m.duplicates, 0) as duplicates, coalesce(m.exclusions, 0) as exclusions,
    coalesce(m.websites, 0) as websites, coalesce(m.assessments, 0) as assessments,
    coalesce(m.qualified_candidates, 0) as qualified_candidates,
    coalesce(m.blocked_inspections, 0) as blocked_inspections,
    coalesce(m.target_remaining, json_extract(r.search_brief, '$.targetCount')) as target_remaining
  from prospecting_runs r left join run_metrics m on m.run_id = r.id`

/** Every run ever created was shipped to the client on each visit to Prospecting Runs. */
const RUN_LIST_LIMIT = 200

function list(database: Database.Database): readonly RunSummary[] {
  const rows = database
    .prepare(`${runSelect} order by r.created_at desc, r.id limit ?`)
    .all(RUN_LIST_LIMIT) as RunRow[]
  return rows.map(mapSummary)
}

function get(database: Database.Database, runId: string): RunDetail {
  const row = database.prepare(`${runSelect} where r.id = ?`).get(runId) as RunRow | undefined
  if (!row) throw new Error("run not found")
  const technicalLog = readTechnicalLog(database, runId)
  return {
    ...mapSummary(row),
    requestedControl: row.requested_control,
    businesses: readBusinesses(database, runId),
    technicalLog: technicalLog.slice(0, TECHNICAL_LOG_LIMIT),
    technicalLogLimit: TECHNICAL_LOG_LIMIT,
    technicalLogTruncated: technicalLog.length > TECHNICAL_LOG_LIMIT,
  }
}

/**
 * The run detail page polls while a run is live, and the log grows with every result a query returns.
 * Unbounded, one ten-business run already answered with 184 KB every 1.5 seconds.
 */
const TECHNICAL_LOG_LIMIT = 200

function mapSummary(row: RunRow): RunSummary {
  return {
    id: row.id,
    state: row.state,
    ...(isCompletionState(row.completion_state) ? { completionState: row.completion_state } : {}),
    ...(row.current_stage ? { currentStage: row.current_stage } : {}),
    searchBrief: JSON.parse(row.search_brief) as SearchBrief,
    progress: progress(row),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    version: row.version,
  }
}

function progress(row: RunRow): RunProgressCounts {
  return {
    queries: row.queries,
    discoveries: row.discoveries,
    duplicates: row.duplicates,
    exclusions: row.exclusions,
    websites: row.websites,
    assessments: row.assessments,
    qualifiedCandidates: row.qualified_candidates,
    blockedInspections: row.blocked_inspections,
    targetRemaining: Math.max(0, row.target_remaining),
  }
}

function readBusinesses(database: Database.Database, runId: string): readonly BusinessProgress[] {
  // The table shows how many log entries name each business, not the entries themselves. Shipping the
  // entries here sent the whole Technical Run Log a second time, and pairing them meant scanning the
  // full log once per task row.
  const eventCounts = new Map(
    (
      database
        .prepare(
          `select business_id, count(*) as total from technical_run_events
           where run_id = ? and business_id is not null group by business_id`,
        )
        .all(runId) as readonly { business_id: string; total: number }[]
    ).map((row) => [row.business_id, row.total]),
  )
  const rows = database
    .prepare(
      `select t.business_id, t.stage, t.status, t.attempt_count, t.failure,
       rb.status as identity_status, rb.exclusion_reason, db.name as business_name,
       cs.total as score_total, cs.qualified as score_qualified
       from run_tasks t left join run_businesses rb
        on rb.run_id = t.run_id and rb.discovered_business_id = t.business_id
       left join discovered_businesses db on db.id = t.business_id
       left join candidate_scores cs on cs.run_business_id = rb.id
       where t.run_id = ? and t.business_id is not null order by t.updated_at desc`,
    )
    .all(runId) as Array<{
    business_id: string
    stage: string
    status: string
    attempt_count: number
    failure: string | null
    identity_status: string | null
    exclusion_reason: string | null
    business_name: string | null
    score_total: number | null
    score_qualified: number | null
  }>
  const businesses = new Map<string, BusinessProgress>()
  for (const row of rows) {
    const existing = businesses.get(row.business_id)
    const failureReason =
      failureMessage(row.failure) ?? row.exclusion_reason ?? existing?.failureReason
    businesses.set(row.business_id, {
      id: row.business_id,
      ...((existing?.name ?? row.business_name)
        ? { name: existing?.name ?? row.business_name ?? undefined }
        : {}),
      currentStage: existing?.currentStage ?? row.stage,
      status: existing?.status ?? row.identity_status ?? row.status,
      retryCount: (existing?.retryCount ?? 0) + Math.max(0, row.attempt_count - 1),
      ...(failureReason ? { failureReason } : {}),
      ...(existing?.score !== undefined
        ? { score: existing.score, qualified: existing.qualified }
        : row.score_total !== null
          ? { score: row.score_total, qualified: row.score_qualified === 1 }
          : {}),
      sourceEventCount: eventCounts.get(row.business_id) ?? 0,
    })
  }
  return [...businesses.values()]
}

function readTechnicalLog(
  database: Database.Database,
  runId: string,
): readonly TechnicalRunEvent[] {
  // One more than the cap from each source, so the merged list can still tell the caller that older
  // entries exist without reading a run's entire history to find out.
  const readLimit = TECHNICAL_LOG_LIMIT + 1
  const transitions = database
    .prepare(
      `select id, event as kind, task_id, to_state, created_at
       from run_transitions where run_id = ? order by created_at desc limit ?`,
    )
    .all(runId, readLimit) as Array<{
    id: string
    kind: string
    task_id: string | null
    to_state: string
    created_at: number
  }>
  const events = database
    .prepare(
      `select id, kind, business_id, source_identifier, result_url, message, created_at
       from technical_run_events where run_id = ? order by created_at desc limit ?`,
    )
    .all(runId, readLimit) as Array<{
    id: string
    kind: string
    business_id: string | null
    source_identifier: string | null
    result_url: string | null
    message: string
    created_at: number
  }>
  return [
    ...transitions.map((transition) => ({
      id: transition.id,
      kind: transition.kind,
      message: `Task transition to ${transition.to_state}.`,
      createdAt: new Date(transition.created_at).toISOString(),
    })),
    ...events.map((event) => ({
      id: event.id,
      kind: event.kind,
      ...(event.business_id ? { businessId: event.business_id } : {}),
      ...(event.source_identifier ? { sourceIdentifier: event.source_identifier } : {}),
      ...(event.result_url ? { resultUrl: event.result_url } : {}),
      message: event.message,
      createdAt: new Date(event.created_at).toISOString(),
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function requestControl(
  database: Database.Database,
  runId: string,
  control: RunControl,
  runtime?: RuntimeId,
): void {
  database.transaction(() => {
    const run = database
      .prepare("select state, requested_control from prospecting_runs where id = ?")
      .get(runId) as { state: string; requested_control: string } | undefined
    if (!run) throw new Error("run not found")
    const now = Date.now()
    if (control === "Pause") pause(database, runId, run.state, now)
    if (control === "Resume") {
      if (runtime) changeRuntime(database, runId, runtime, now)
      resume(database, runId, run.state, now)
    }
    if (control === "Cancel") cancel(database, runId, run.state, now)
  })()
}

function changeRuntime(
  database: Database.Database,
  runId: string,
  runtime: RuntimeId,
  now: number,
): void {
  const raw = database
    .prepare("select search_brief from prospecting_runs where id=?")
    .pluck()
    .get(runId)
  if (typeof raw !== "string") throw new Error("run not found")
  const brief = JSON.parse(raw) as SearchBrief
  if (brief.runtime === runtime) return
  database
    .prepare("update prospecting_runs set search_brief=? where id=?")
    .run(JSON.stringify({ ...brief, runtime }), runId)
  database
    .prepare(
      `insert into technical_run_events (id,run_id,kind,message,details,schema_version,created_at) values (?,?,'RuntimeChanged','The selected subscription runtime changed during explicit resume.',?,1,?)`,
    )
    .run(crypto.randomUUID(), runId, JSON.stringify({ from: brief.runtime, to: runtime }), now)
}

function pause(database: Database.Database, runId: string, fromState: string, now: number): void {
  if (["Completed", "Cancelled"].includes(fromState)) throw new Error("terminal run")
  const leased = taskCount(database, runId, "Leased")
  const state = leased > 0 ? "Pausing" : "Paused"
  database
    .prepare(
      `update prospecting_runs set requested_control = 'Pause', state = ?, completion_state = ?,
       updated_at = ?, version = version + 1 where id = ?`,
    )
    .run(state, leased > 0 ? null : "Paused", now, runId)
  transition(database, runId, fromState, state, "PauseRequested", now)
}

function resume(database: Database.Database, runId: string, fromState: string, now: number): void {
  if (fromState === "Cancelled" || fromState === "Completed") throw new Error("terminal run")
  database
    .prepare(
      `update run_tasks set status = 'Pending', available_at = ?, failure = null,
       updated_at = ?, version = version + 1 where run_id = ? and status = 'Blocked'`,
    )
    .run(now, now, runId)
  const nextState = taskCount(database, runId, "Leased") > 0 ? "Running" : "Pending"
  database
    .prepare(
      `update prospecting_runs set requested_control = 'None', state = ?, completion_state = null,
       updated_at = ?, version = version + 1 where id = ?`,
    )
    .run(nextState, now, runId)
  transition(database, runId, fromState, nextState, "RunResumed", now)
}

function cancel(database: Database.Database, runId: string, fromState: string, now: number): void {
  if (fromState === "Completed" || fromState === "Cancelled") throw new Error("terminal run")
  database
    .prepare(
      `update run_tasks set status = 'Cancelled', updated_at = ?, version = version + 1
       where run_id = ? and status in ('Pending', 'Blocked')`,
    )
    .run(now, runId)
  const leased = taskCount(database, runId, "Leased")
  const state = leased > 0 ? "Cancelling" : "Cancelled"
  database
    .prepare(
      `update prospecting_runs set requested_control = 'Cancel', state = ?, completion_state = ?,
       updated_at = ?, version = version + 1 where id = ?`,
    )
    .run(state, leased > 0 ? null : "Cancelled with Partial Results", now, runId)
  transition(database, runId, fromState, state, "CancelRequested", now)
}

function taskCount(database: Database.Database, runId: string, status: string): number {
  return Number(
    database
      .prepare("select count(*) from run_tasks where run_id = ? and status = ?")
      .pluck()
      .get(runId, status),
  )
}

function transition(
  database: Database.Database,
  runId: string,
  fromState: string,
  toState: string,
  event: string,
  now: number,
): void {
  database
    .prepare(
      `insert into run_transitions
       (id, run_id, from_state, to_state, event, payload, schema_version, created_at)
       values (?, ?, ?, ?, ?, '{}', 1, ?)`,
    )
    .run(crypto.randomUUID(), runId, fromState, toState, event, now)
}

function isCompletionState(value: string | null): value is RunCompletionState {
  return value !== null && runCompletionStates.some((state) => state === value)
}

function failureMessage(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
      ? parsed.message
      : undefined
  } catch {
    return undefined
  }
}
