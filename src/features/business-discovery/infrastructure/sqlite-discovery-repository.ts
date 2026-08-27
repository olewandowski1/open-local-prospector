import type Database from "better-sqlite3"
import { Effect } from "effect"
import {
  type CompletedDiscoveryPage,
  DiscoveryPersistenceError,
  type DiscoveryProgress,
  type DiscoveryRepository,
  type RecordedDiscoveryPage,
  type RecordReportInput,
} from "@/features/business-discovery/application/discovery-repository"
import {
  normalizeBusinessName,
  normalizeDiscoveryUrl,
} from "@/features/business-discovery/domain/discovered-business"
import {
  DISCOVERY_REPORT_PROMPT_VERSION,
  DISCOVERY_STRUCTURE_PROMPT_VERSION,
  DISCOVERY_STRUCTURE_SCHEMA_VERSION,
  MAX_REPORT_CHARACTERS,
  type StructuredBusiness,
} from "@/features/business-discovery/domain/discovery-structure"
import { sharedDatabase } from "@/features/local-application"

const MAX_RECORDED_REJECTIONS = 50

export function makeSqliteDiscoveryRepository(databasePath: string): DiscoveryRepository {
  return {
    getProgress: (runId) =>
      databaseEffect(databasePath, "progress", (database) => readProgress(database, runId)),
    getCompletedPage: (runId, query, offset) =>
      databaseEffect(databasePath, "lookup-page", (database) => {
        const row = database
          .prepare(
            `select more_results from discovery_queries
             where run_id = ? and query_text = ? and page_offset = ?`,
          )
          .get(runId, query, offset) as { more_results: number } | undefined
        return row
          ? ({ moreResults: row.more_results === 1 } satisfies CompletedDiscoveryPage)
          : undefined
      }),
    recordReport: (input) =>
      databaseEffect(databasePath, "record-page", (database) => recordReport(database, input)),
  }
}

function databaseEffect<A>(
  databasePath: string,
  operation: DiscoveryPersistenceError["operation"],
  use: (database: Database.Database) => A,
) {
  return Effect.try({
    try: () => use(sharedDatabase(databasePath)),
    catch: () => new DiscoveryPersistenceError({ operation }),
  })
}

function recordReport(
  database: Database.Database,
  input: RecordReportInput,
): RecordedDiscoveryPage {
  return database.transaction(() => {
    const existing = database
      .prepare(
        `select more_results from discovery_queries
         where run_id = ? and query_text = ? and page_offset = 0`,
      )
      .get(input.runId, input.query) as { more_results: number } | undefined
    if (existing) {
      return { uniqueAdded: 0, duplicates: 0, progress: readProgress(database, input.runId) }
    }

    const queryId = crypto.randomUUID()
    const timestamp = input.recordedAt.getTime()
    let uniqueAdded = 0
    let duplicates = 0
    let nextRank =
      Number(
        database
          .prepare(
            "select coalesce(max(discovery_rank), 0) from discovered_businesses where run_id = ?",
          )
          .pluck()
          .get(input.runId),
      ) + 1

    const occurrences: Array<{ businessId: string; resultUrl: string; duplicate: boolean }> = []
    const insertEvent = database.prepare(
      `insert into technical_run_events
       (id, run_id, task_id, business_id, kind, source_identifier, result_url, message,
        details, schema_version, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )

    for (const business of input.businesses) {
      const resultUrl = primaryUrl(business)
      if (!resultUrl) continue
      // Key by business because one structured business can be reached through several pages.
      const discoveryKey = `${input.source}:${normalizeBusinessName(business.name)}|${normalizeBusinessName(business.locality)}`
      const existingBusiness = database
        .prepare("select id from discovered_businesses where run_id = ? and discovery_key = ?")
        .get(input.runId, discoveryKey) as { id: string } | undefined
      const businessId = existingBusiness?.id ?? crypto.randomUUID()
      if (existingBusiness) {
        duplicates += 1
      } else {
        database
          .prepare(
            `insert into discovered_businesses
             (id, run_id, source, source_identifier, discovery_key, name, normalized_name,
              result_url, description, raw_attributes, structured, discovery_rank, discovered_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            businessId,
            input.runId,
            input.source,
            resultUrl,
            discoveryKey,
            business.name,
            normalizeBusinessName(business.name),
            resultUrl,
            null,
            "{}",
            JSON.stringify(business),
            nextRank,
            timestamp,
          )
        nextRank += 1
        uniqueAdded += 1
      }

      occurrences.push({ businessId, resultUrl, duplicate: Boolean(existingBusiness) })
      insertEvent.run(
        crypto.randomUUID(),
        input.runId,
        input.taskId,
        businessId,
        "DiscoveryResult",
        input.source,
        resultUrl,
        existingBusiness
          ? "The structured report named a business this run already holds."
          : "The structured report named a business.",
        JSON.stringify({
          query: input.query,
          sources: business.sourceUrls.length,
          contacts: business.contacts.length,
          decisionScope: business.decisionScope,
        }),
        timestamp,
      )
    }

    database
      .prepare(
        `insert into discovery_queries
         (id, run_id, task_id, source, query_text, page_offset, result_count, unique_count,
          duplicate_count, more_results, completed_at)
         values (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?)`,
      )
      .run(
        queryId,
        input.runId,
        input.taskId,
        input.source,
        input.query,
        input.returned,
        uniqueAdded,
        duplicates,
        timestamp,
      )

    const insertOccurrence = database.prepare(
      `insert into discovery_occurrences
       (id, run_id, query_id, business_id, source_identifier, result_url, duplicate_input,
        raw_attributes, discovered_at)
       values (?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
    )
    for (const occurrence of occurrences) {
      insertOccurrence.run(
        crypto.randomUUID(),
        input.runId,
        queryId,
        occurrence.businessId,
        occurrence.resultUrl,
        occurrence.resultUrl,
        occurrence.duplicate ? 1 : 0,
        timestamp,
      )
    }

    database
      .prepare(
        `insert into discovery_reports
         (id, run_id, task_id, query_text, report_text, report_prompt_version,
          structure_prompt_version, structure_schema_version, runtime_id, runtime_model,
          businesses_returned, businesses_verified, rejections, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        input.runId,
        input.taskId,
        input.query,
        input.report.slice(0, MAX_REPORT_CHARACTERS),
        DISCOVERY_REPORT_PROMPT_VERSION,
        DISCOVERY_STRUCTURE_PROMPT_VERSION,
        DISCOVERY_STRUCTURE_SCHEMA_VERSION,
        input.runtimeId,
        input.runtimeModel ?? null,
        input.returned,
        input.businesses.length,
        JSON.stringify(input.rejections.slice(0, MAX_RECORDED_REJECTIONS)),
        timestamp,
      )

    insertEvent.run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      null,
      "DiscoveryQuery",
      input.source,
      null,
      "A bounded public search was reported and structured into businesses.",
      JSON.stringify({
        query: input.query,
        returned: input.returned,
        verified: input.businesses.length,
        uniqueAdded,
        duplicates,
        rejected: input.rejections.length,
      }),
      timestamp,
    )

    // Rejection counts distinguish unsupported runtime claims from an empty search.
    for (const rejection of input.rejections.slice(0, MAX_RECORDED_REJECTIONS)) {
      insertEvent.run(
        crypto.randomUUID(),
        input.runId,
        input.taskId,
        null,
        "DiscoveryRejected",
        input.source,
        null,
        "A structured claim was dropped because the report did not support it.",
        JSON.stringify(rejection),
        timestamp,
      )
    }

    const progress = readProgress(database, input.runId)
    database
      .prepare(
        `update run_metrics set queries = queries + 1, discoveries = ?,
         duplicates = duplicates + ?, updated_at = ?, version = version + 1
         where run_id = ?`,
      )
      .run(progress.uniqueBusinesses, duplicates, timestamp, input.runId)
    return { uniqueAdded, duplicates, progress }
  })()
}

function primaryUrl(business: StructuredBusiness): string | undefined {
  const candidates = [business.websiteUrl, ...business.sourceUrls].filter(
    (value): value is string => value !== undefined,
  )
  for (const candidate of candidates) {
    const normalized = normalizeDiscoveryUrl(candidate)
    if (normalized) return normalized
  }
  return undefined
}

function readProgress(database: Database.Database, runId: string): DiscoveryProgress {
  const businessIds = database
    .prepare(
      "select id from discovered_businesses where run_id = ? order by discovery_rank, discovered_at, id",
    )
    .all(runId) as readonly { id: string }[]
  return { uniqueBusinesses: businessIds.length, businessIds: businessIds.map((row) => row.id) }
}
