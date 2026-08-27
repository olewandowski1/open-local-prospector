import Database from "better-sqlite3"
import { Effect, Option } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import {
  controlRun,
  getRun,
  listRuns,
} from "@/features/run-monitoring/application/run-repositories"
import {
  rewriteDiscoveryTaskInput,
  sqliteRunMonitoringLive,
} from "@/features/run-monitoring/infrastructure/sqlite-run-monitoring"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"
import { makeSqliteRunTaskRepository, type RunTask } from "@/test-support/run-task"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("SQLite run monitoring", () => {
  it("rewrites only a recognized versioned discovery input", () => {
    const input = discoveryInput("codex", true)
    const rewritten = JSON.parse(rewriteDiscoveryTaskInput(input, 1, "claude"))

    expect(rewritten).toMatchObject({
      marker: "preserved",
      searchBrief: { runtime: "claude", category: "Dental clinics" },
    })
    expect(rewritten.searchBrief).not.toHaveProperty("runtimeConfiguration")
    expect(
      JSON.parse(rewriteDiscoveryTaskInput(discoveryInput("codex", false), 1, "claude")).searchBrief
        .runtime,
    ).toBe("claude")
    expect(() => rewriteDiscoveryTaskInput("{", 1, "claude")).toThrow(
      "invalid discovery task input",
    )
    expect(() => rewriteDiscoveryTaskInput("{}", 1, "claude")).toThrow(
      "invalid discovery task input",
    )
    expect(() => rewriteDiscoveryTaskInput(input, 2, "claude")).toThrow(
      "unsupported discovery task input version",
    )
  })

  it.each([
    ["codex", "claude"],
    ["claude", "opencode"],
    ["opencode", "codex"],
  ] as const)("switches unfinished discovery input durably from %s to %s", async (from, to) => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, `runtime-switch-${from}`, {
      runtime: from,
      runtimeConfiguration: { model: "gpt-5.6-sol", reasoningEffort: "medium" },
    })
    const originalInput = discoveryInput(from, true)
    const sqlite = new Database(database.path)
    try {
      sqlite
        .prepare(`update prospecting_runs set state='Paused',completion_state='Paused' where id=?`)
        .run(run.id)
      sqlite
        .prepare(
          `update run_tasks set stage='DiscoverBusinesses',status='Blocked',input=?,schema_version=1,
           failure='{"code":"runtime-unavailable"}' where run_id=?`,
        )
        .run(originalInput, run.id)
      const insertTask = sqlite.prepare(
        `insert into run_tasks
         (id,run_id,stage,status,attempt_count,max_attempts,available_at,input,schema_version,
          version,created_at,updated_at) values (?,?, 'DiscoverBusinesses', ?,0,3,1,?,1,1,1,1)`,
      )
      for (const status of ["Completed", "Cancelled", "FailedPermanent", "Leased"] as const) {
        insertTask.run(`sentinel-${status}`, run.id, status, originalInput)
      }
    } finally {
      sqlite.close()
    }

    await Effect.runPromise(
      controlRun(run.id, "Resume", to).pipe(Effect.provide(sqliteRunMonitoringLive(database.path))),
    )

    const checked = new Database(database.path, { readonly: true })
    try {
      const runBrief = JSON.parse(
        String(
          checked
            .prepare("select search_brief from prospecting_runs where id=?")
            .pluck()
            .get(run.id),
        ),
      )
      expect(runBrief.runtime).toBe(to)
      expect(runBrief).not.toHaveProperty("runtimeConfiguration")
      const pending = checked
        .prepare("select input,status,failure from run_tasks where run_id=? and status='Pending'")
        .get(run.id) as { input: string; status: string; failure: string | null }
      const pendingInput = JSON.parse(pending.input)
      expect(pendingInput.searchBrief.runtime).toBe(to)
      expect(pendingInput.searchBrief).not.toHaveProperty("runtimeConfiguration")
      expect(pending.failure).toBeNull()
      for (const status of ["Completed", "Cancelled", "FailedPermanent", "Leased"] as const) {
        expect(
          checked
            .prepare("select input from run_tasks where id=?")
            .pluck()
            .get(`sentinel-${status}`),
        ).toBe(originalInput)
      }
      const runtimeEvent = checked
        .prepare(
          "select details from technical_run_events where run_id=? and kind='RuntimeChanged'",
        )
        .pluck()
        .get(run.id)
      expect(JSON.parse(String(runtimeEvent))).toEqual({ from, to })
    } finally {
      checked.close()
    }
    await Effect.runPromise(
      controlRun(run.id, "Resume", to).pipe(Effect.provide(sqliteRunMonitoringLive(database.path))),
    )
    expect(
      readScalar(
        database.path,
        "select count(*) from technical_run_events where run_id=? and kind='RuntimeChanged'",
        run.id,
      ),
    ).toBe(1)
  })

  it("rolls back a runtime switch when unfinished discovery input is malformed", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "invalid-runtime-switch")
    const sqlite = new Database(database.path)
    try {
      sqlite
        .prepare("update prospecting_runs set state='Paused',completion_state='Paused' where id=?")
        .run(run.id)
      sqlite
        .prepare(
          "update run_tasks set stage='DiscoverBusinesses',status='Blocked',input='{}' where run_id=?",
        )
        .run(run.id)
    } finally {
      sqlite.close()
    }

    await expect(
      Effect.runPromise(
        controlRun(run.id, "Resume", "claude").pipe(
          Effect.provide(sqliteRunMonitoringLive(database.path)),
        ),
      ),
    ).rejects.toBeDefined()

    const checked = new Database(database.path, { readonly: true })
    try {
      expect(
        JSON.parse(
          String(
            checked
              .prepare("select search_brief from prospecting_runs where id=?")
              .pluck()
              .get(run.id),
          ),
        ).runtime,
      ).toBe("codex")
      expect(
        checked.prepare("select status from run_tasks where run_id=?").pluck().get(run.id),
      ).toBe("Blocked")
      expect(
        checked
          .prepare("select count(*) from technical_run_events where kind='RuntimeChanged'")
          .pluck()
          .get(),
      ).toBe(0)
    } finally {
      checked.close()
    }
  })

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
           values (?, ?, 'DiscoveryResult', 'subscription-runtime-web-search', 'https://example.com/result',
             'A public result URL was returned.', '{}', 1, ?)`,
        )
        .run(crypto.randomUUID(), run.id, Date.now())
    } finally {
      sqlite.close()
    }
    const layer = sqliteRunMonitoringLive(database.path)
    const runList = await Effect.runPromise(listRuns(new Date()).pipe(Effect.provide(layer)))
    const detail = await Effect.runPromise(getRun(run.id).pipe(Effect.provide(layer)))

    expect(runList).toMatchObject({
      limit: 200,
      truncated: false,
      overview: { discoveries: 8, activeRuns: 1, hasRuns: true },
    })
    expect(runList.runs[0]?.progress).toEqual({
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
          sourceIdentifier: "subscription-runtime-web-search",
          resultUrl: "https://example.com/result",
        }),
      ]),
    )
    expect(JSON.stringify(detail)).not.toContain("chain-of-thought")
  })

  it("bounds displayed run history without truncating overview totals", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const firstRun = await createTestProspectingRun(database.path, "bounded-run-0")
    const sqlite = new Database(database.path)
    try {
      const duplicateRun = sqlite.prepare(
        `insert into prospecting_runs
         (id,request_id,search_brief,state,completion_state,current_stage,requested_control,version,
          created_at,updated_at)
         select ?,?,search_brief,state,completion_state,current_stage,requested_control,version,?,?
         from prospecting_runs where id=?`,
      )
      sqlite.transaction(() => {
        for (let index = 1; index < 201; index += 1) {
          duplicateRun.run(
            `bounded-run-${index}`,
            `bounded-request-${index}`,
            index,
            index,
            firstRun.id,
          )
        }
      })()
      sqlite.prepare("update run_metrics set discoveries = 1").run()
    } finally {
      sqlite.close()
    }

    const runList = await Effect.runPromise(
      listRuns(new Date()).pipe(Effect.provide(sqliteRunMonitoringLive(database.path))),
    )

    expect(runList).toMatchObject({
      limit: 200,
      truncated: true,
      overview: { discoveries: 201, activeRuns: 201, hasRuns: true },
    })
    expect(runList.runs).toHaveLength(200)
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

  it("gives cancellation precedence when the final task reports completion", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "cancel-final-run")
    const tasks = makeSqliteRunTaskRepository(database.path)
    const monitoring = sqliteRunMonitoringLive(database.path)
    const now = new Date(Date.now() + 1_000)
    const finalTask = requiredTask(await Effect.runPromise(tasks.claimNext("worker", now, 30_000)))

    await Effect.runPromise(controlRun(run.id, "Cancel").pipe(Effect.provide(monitoring)))
    await Effect.runPromise(
      tasks.complete(
        finalTask,
        "worker",
        { value: { finished: true }, completionState: "Search Exhausted" },
        new Date(now.getTime() + 10),
      ),
    )

    expect(await readDetail(database.path, run.id)).toMatchObject({
      state: "Cancelled",
      completionState: "Cancelled with Partial Results",
    })
  })

  it("settles completed work instead of creating a taskless paused run", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "pause-final-run")
    const tasks = makeSqliteRunTaskRepository(database.path)
    const monitoring = sqliteRunMonitoringLive(database.path)
    const now = new Date(Date.now() + 1_000)
    const finalTask = requiredTask(await Effect.runPromise(tasks.claimNext("worker", now, 30_000)))

    await Effect.runPromise(controlRun(run.id, "Pause").pipe(Effect.provide(monitoring)))
    await Effect.runPromise(
      tasks.complete(
        finalTask,
        "worker",
        { value: { finished: true }, completionState: "Search Exhausted" },
        new Date(now.getTime() + 10),
      ),
    )

    expect(await readDetail(database.path, run.id)).toMatchObject({
      state: "Completed",
      completionState: "Search Exhausted",
    })
  })

  it("repairs a legacy taskless pause when resume is requested", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const run = await createTestProspectingRun(database.path, "taskless-pause-run")
    const connection = new Database(database.path)
    try {
      connection.prepare("update run_tasks set status = 'Completed' where run_id = ?").run(run.id)
      connection
        .prepare(
          `update prospecting_runs set state = 'Paused', completion_state = 'Paused',
           requested_control = 'Pause' where id = ?`,
        )
        .run(run.id)
    } finally {
      connection.close()
    }

    await Effect.runPromise(
      controlRun(run.id, "Resume").pipe(Effect.provide(sqliteRunMonitoringLive(database.path))),
    )

    expect(await readDetail(database.path, run.id)).toMatchObject({
      state: "Completed",
      completionState: "Search Exhausted",
    })
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

function discoveryInput(runtime: "codex" | "claude" | "opencode", configured: boolean): string {
  return JSON.stringify({
    marker: "preserved",
    searchBrief: {
      location: "Krakow",
      category: "Dental clinics",
      targetCount: 5,
      mode: "Quick",
      runtime,
      ...(configured
        ? { runtimeConfiguration: { model: "provider-model", reasoningEffort: "medium" } }
        : {}),
      searchArea: {
        id: "relation:276892",
        displayName: "Krakow, Polska",
        latitude: 50.0614,
        longitude: 19.9366,
        countryCode: "PL",
      },
    },
  })
}

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
