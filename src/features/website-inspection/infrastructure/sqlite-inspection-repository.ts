import Database from "better-sqlite3"
import { Effect } from "effect"
import type { SearchBrief } from "@/features/prospecting-runs"
import type {
  InspectionRepository,
  InspectionTarget,
} from "@/features/website-inspection/application/inspection-repository"
import { InspectionPersistenceError } from "@/features/website-inspection/application/inspection-repository"
import type { WebsiteInspectionResult } from "@/features/website-inspection/application/website-inspector"

export function makeSqliteInspectionRepository(databasePath: string): InspectionRepository {
  return {
    loadTarget: (runId, runBusinessId) =>
      databaseEffect(databasePath, "load", (database) =>
        loadTarget(database, runId, runBusinessId),
      ),
    commit: (input) =>
      databaseEffect(databasePath, "commit", (database) => commit(database, input)),
  }
}

function databaseEffect<A>(
  databasePath: string,
  operation: InspectionPersistenceError["operation"],
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
    catch: () => new InspectionPersistenceError({ operation }),
  })
}

function loadTarget(
  database: Database.Database,
  runId: string,
  runBusinessId: string,
): InspectionTarget {
  const row = database
    .prepare(
      `select rb.id as run_business_id, rb.canonical_business_id, cb.name, r.search_brief,
       (select op.url from online_presences op where op.run_business_id = rb.id
        and op.type = 'Website' and op.association_state = 'Confirmed'
        order by op.collected_at, op.id limit 1) as website_url
       from run_businesses rb
       join canonical_businesses cb on cb.id = rb.canonical_business_id
       join prospecting_runs r on r.id = rb.run_id
       where rb.id = ? and rb.run_id = ?`,
    )
    .get(runBusinessId, runId) as
    | {
        run_business_id: string
        canonical_business_id: string
        name: string
        search_brief: string
        website_url: string | null
      }
    | undefined
  if (!row) throw new Error("inspection target missing")
  return {
    runBusinessId: row.run_business_id,
    canonicalBusinessId: row.canonical_business_id,
    name: row.name,
    searchBrief: JSON.parse(row.search_brief) as SearchBrief,
    ...(row.website_url ? { websiteUrl: row.website_url } : {}),
  }
}

function commit(
  database: Database.Database,
  input: Parameters<InspectionRepository["commit"]>[0],
): string {
  return database.transaction(() => {
    const existing = database
      .prepare("select id from website_inspections where task_id = ?")
      .get(input.taskId) as { id: string } | undefined
    if (existing) return existing.id
    const inspectionId = crypto.randomUUID()
    database
      .prepare(
        `insert into website_inspections
         (id, run_id, task_id, run_business_id, canonical_business_id, status,
          configuration_version, started_at, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        inspectionId,
        input.runId,
        input.taskId,
        input.target.runBusinessId,
        input.target.canonicalBusinessId,
        input.result.status,
        input.result.configurationVersion,
        input.result.startedAt.getTime(),
        input.result.completedAt.getTime(),
      )
    insertPages(database, inspectionId, input.result)
    insertBlocks(database, inspectionId, input.result)
    const runBusinessStatus = {
      Complete: "Inspected",
      Partial: "InspectionPartial",
      Blocked: "InspectionBlocked",
      NoWebsite: "NoWebsite",
    }[input.result.status]
    database
      .prepare("update run_businesses set status = ?, updated_at = ? where id = ?")
      .run(runBusinessStatus, input.result.completedAt.getTime(), input.target.runBusinessId)
    updateMetrics(database, input.runId, input.result.completedAt)
    recordTechnicalEvents(database, input, inspectionId)
    return inspectionId
  })()
}

function insertPages(
  database: Database.Database,
  inspectionId: string,
  result: WebsiteInspectionResult,
): void {
  const insertPage = database.prepare(
    `insert into inspection_pages
     (id, inspection_id, sequence, viewport, requested_url, final_url, title, description,
      language, rendered_text, links, forms, console_failures, network_failures,
      measurements, captured_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertArtifact = database.prepare(
    `insert into inspection_artifacts
     (id, inspection_id, page_id, kind, viewport, path, mime_type, byte_size, sha256, created_at)
     values (?, ?, ?, 'Screenshot', ?, ?, 'image/png', ?, ?, ?)`,
  )
  for (const page of result.pages) {
    const pageId = crypto.randomUUID()
    insertPage.run(
      pageId,
      inspectionId,
      page.sequence,
      page.viewport,
      page.requestedUrl,
      page.finalUrl,
      page.title,
      page.description ?? null,
      page.language ?? null,
      page.renderedText,
      JSON.stringify(page.links),
      JSON.stringify(page.forms),
      JSON.stringify(page.consoleFailures),
      JSON.stringify(page.networkFailures),
      JSON.stringify(page.measurements),
      page.capturedAt.getTime(),
    )
    insertArtifact.run(
      crypto.randomUUID(),
      inspectionId,
      pageId,
      page.viewport,
      page.screenshotPath,
      page.screenshotBytes,
      page.screenshotSha256,
      page.capturedAt.getTime(),
    )
  }
}

function insertBlocks(
  database: Database.Database,
  inspectionId: string,
  result: WebsiteInspectionResult,
): void {
  const insert = database.prepare(
    `insert into inspection_blocks (id, inspection_id, code, url, message, recorded_at)
     values (?, ?, ?, ?, ?, ?)`,
  )
  for (const block of result.blocks) {
    insert.run(
      crypto.randomUUID(),
      inspectionId,
      block.code,
      block.url ?? null,
      block.message,
      block.recordedAt.getTime(),
    )
  }
}

function updateMetrics(database: Database.Database, runId: string, now: Date): void {
  const counts = database
    .prepare(
      `select count(*) as inspections,
       sum(case when status in ('Partial', 'Blocked') then 1 else 0 end) as blocked
       from website_inspections where run_id = ? and status != 'NoWebsite'`,
    )
    .get(runId) as { inspections: number; blocked: number | null }
  database
    .prepare(
      `update run_metrics set websites = ?, blocked_inspections = ?, updated_at = ?,
       version = version + 1 where run_id = ?`,
    )
    .run(counts.inspections, counts.blocked ?? 0, now.getTime(), runId)
}

function recordTechnicalEvents(
  database: Database.Database,
  input: Parameters<InspectionRepository["commit"]>[0],
  inspectionId: string,
): void {
  const insert = database.prepare(
    `insert into technical_run_events
     (id, run_id, task_id, business_id, kind, source_identifier, result_url, message,
      details, schema_version, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  )
  for (const page of input.result.pages) {
    insert.run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      input.target.runBusinessId,
      "InspectionPage",
      inspectionId,
      page.finalUrl,
      `A ${page.viewport.toLocaleLowerCase("en")} page inspection was committed.`,
      JSON.stringify({ viewport: page.viewport, sequence: page.sequence }),
      page.capturedAt.getTime(),
    )
  }
  for (const block of input.result.blocks) {
    insert.run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      input.target.runBusinessId,
      "InspectionBlock",
      inspectionId,
      block.url ?? null,
      block.message,
      JSON.stringify({ code: block.code }),
      block.recordedAt.getTime(),
    )
  }
}
