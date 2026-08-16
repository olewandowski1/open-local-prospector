import { dirname } from "node:path"
import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { RunTask } from "@/features/run-execution"
import { makeInspectionTaskExecutor } from "@/features/website-inspection/application/inspect-website"
import type {
  WebsiteInspectionResult,
  WebsiteInspector,
} from "@/features/website-inspection/application/website-inspector"
import { makeSqliteInspectionRepository } from "@/features/website-inspection/infrastructure/sqlite-inspection-repository"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("website inspection workflow", () => {
  it("persists page evidence, screenshot metadata, deterministic measurements, and blocks", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedInspectionTask(database.path, "inspection-partial", true)
    const inspector = vi.fn<WebsiteInspector["inspect"]>(() => Effect.succeed(partialResult()))

    const checkpoint = await Effect.runPromise(
      makeInspectionTaskExecutor(
        { inspect: inspector },
        makeSqliteInspectionRepository(database.path),
        dirname(database.path),
      )(task),
    )

    expect(inspector).toHaveBeenCalledOnce()
    expect(checkpoint).toMatchObject({ value: { status: "Partial", pages: 1, blocks: 1 } })
    expect(checkpoint.nextTasks).toEqual([
      expect.objectContaining({ stage: "AssessWebsiteOpportunity", businessId: task.businessId }),
    ])
    expect(readScalar(database.path, "select count(*) from inspection_pages")).toBe(1)
    expect(readScalar(database.path, "select count(*) from inspection_artifacts")).toBe(1)
    expect(readScalar(database.path, "select count(*) from inspection_blocks")).toBe(1)
    expect(readRow(database.path, "select websites, blocked_inspections from run_metrics")).toEqual(
      {
        websites: 1,
        blocked_inspections: 1,
      },
    )
    const page = readRow(
      database.path,
      "select rendered_text, measurements, console_failures, network_failures from inspection_pages",
    ) as Record<string, string>
    expect(page.rendered_text).toBe("Public rendered text")
    expect(JSON.parse(page.measurements)).toMatchObject({ domNodes: 10, usesHttps: true })
    expect(JSON.parse(page.console_failures)).toEqual(["console error"])
  })

  it("checkpoints no-site candidates without launching a browser", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedInspectionTask(database.path, "inspection-no-site", false)
    const inspector = vi.fn<WebsiteInspector["inspect"]>()

    const checkpoint = await Effect.runPromise(
      makeInspectionTaskExecutor(
        { inspect: inspector },
        makeSqliteInspectionRepository(database.path),
        dirname(database.path),
      )(task),
    )

    expect(inspector).not.toHaveBeenCalled()
    expect(checkpoint.value.status).toBe("NoWebsite")
    expect(readRow(database.path, "select status from website_inspections")).toEqual({
      status: "NoWebsite",
    })
    expect(readRow(database.path, "select websites, blocked_inspections from run_metrics")).toEqual(
      {
        websites: 0,
        blocked_inspections: 0,
      },
    )
  })
})

async function seedInspectionTask(
  databasePath: string,
  requestId: string,
  withWebsite: boolean,
): Promise<RunTask> {
  const run = await createTestProspectingRun(databasePath, requestId)
  const values = withDatabase(databasePath, (database) => {
    const taskId = String(
      database.prepare("select id from run_tasks where run_id = ?").pluck().get(run.id),
    )
    const discoveredBusinessId = crypto.randomUUID()
    const canonicalBusinessId = crypto.randomUUID()
    const runBusinessId = crypto.randomUUID()
    const now = Date.now()
    database
      .prepare(
        `insert into discovered_businesses
       (id, run_id, source, source_identifier, discovery_key, name, normalized_name,
        result_url, raw_attributes, discovered_at)
       values (?, ?, 'fixture', ?, ?, 'Gabinet Uśmiech', 'gabinet uśmiech', ?, '{}', ?)`,
      )
      .run(
        discoveredBusinessId,
        run.id,
        `fixture:${requestId}`,
        `fixture:${requestId}`,
        `https://seed.test/${requestId}`,
        now,
      )
    database
      .prepare(
        `insert into canonical_businesses
       (id, identity_fingerprint, name, normalized_name, locality, country_code,
        decision_scope, created_at, updated_at)
       values (?, ?, 'Gabinet Uśmiech', 'gabinet uśmiech', 'Kraków', 'PL', 'Local', ?, ?)`,
      )
      .run(canonicalBusinessId, `fingerprint:${requestId}`, now, now)
    database
      .prepare(
        `insert into run_businesses
       (id, run_id, discovered_business_id, canonical_business_id, status, identity_confidence,
        signals, created_at, updated_at)
       values (?, ?, ?, ?, 'Eligible', 'Corroborated', '[]', ?, ?)`,
      )
      .run(runBusinessId, run.id, discoveredBusinessId, canonicalBusinessId, now, now)
    if (withWebsite) {
      database
        .prepare(
          `insert into online_presences
         (id, canonical_business_id, run_business_id, type, url, source_identifier,
          association_state, collected_at)
         values (?, ?, ?, 'Website', 'https://public.test/', 'fixture:website', 'Confirmed', ?)`,
        )
        .run(crypto.randomUUID(), canonicalBusinessId, runBusinessId, now)
    }
    return { taskId, discoveredBusinessId, canonicalBusinessId, runBusinessId }
  })
  return {
    id: values.taskId,
    runId: run.id,
    businessId: values.discoveredBusinessId,
    stage: "InspectWebsite",
    status: "Leased",
    attemptCount: 1,
    maxAttempts: 3,
    input: {
      runBusinessId: values.runBusinessId,
      canonicalBusinessId: values.canonicalBusinessId,
      ...(withWebsite ? { websiteUrl: "https://public.test/" } : {}),
    },
    schemaVersion: 1,
    version: 1,
  }
}

function partialResult(): WebsiteInspectionResult {
  const now = new Date("2026-08-16T10:00:00.000Z")
  return {
    status: "Partial",
    startedAt: now,
    completedAt: now,
    configurationVersion: "quick-v1",
    blocks: [{ code: "relevant-page-not-found", message: "No relevant page.", recordedAt: now }],
    pages: [
      {
        sequence: 0,
        viewport: "Desktop",
        requestedUrl: "https://public.test/",
        finalUrl: "https://public.test/",
        title: "Public",
        renderedText: "Public rendered text",
        links: [],
        forms: [],
        consoleFailures: ["console error"],
        networkFailures: ["GET https://asset.test failed"],
        measurements: {
          domNodes: 10,
          headings: 1,
          links: 0,
          forms: 0,
          images: 0,
          imagesMissingAlt: 0,
          unlabeledControls: 0,
          horizontalOverflow: false,
          usesHttps: true,
        },
        capturedAt: now,
        screenshotPath: "C:\\artifacts\\desktop.png",
        screenshotBytes: 128,
        screenshotSha256: "a".repeat(64),
      },
    ],
  }
}

function readScalar(databasePath: string, query: string): number {
  return Number(withDatabase(databasePath, (database) => database.prepare(query).pluck().get()))
}

function readRow(databasePath: string, query: string): Record<string, unknown> | undefined {
  return withDatabase(
    databasePath,
    (database) => database.prepare(query).get() as Record<string, unknown> | undefined,
  )
}

function withDatabase<A>(databasePath: string, use: (database: Database.Database) => A): A {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    database.pragma("foreign_keys = ON")
    return use(database)
  } finally {
    database.close()
  }
}
