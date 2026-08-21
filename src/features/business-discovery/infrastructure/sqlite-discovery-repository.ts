import type Database from "better-sqlite3"
import { Effect } from "effect"
import {
  type CompletedDiscoveryPage,
  DiscoveryPersistenceError,
  type DiscoveryProgress,
  type DiscoveryRepository,
  type RecordedDiscoveryPage,
} from "@/features/business-discovery/application/discovery-repository"
import {
  normalizeBusinessName,
  normalizeDiscoveryUrl,
} from "@/features/business-discovery/domain/discovered-business"
import { sharedDatabase } from "@/features/local-application"

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
    recordPage: (input) =>
      databaseEffect(databasePath, "record-page", (database) => recordPage(database, input)),
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

function recordPage(
  database: Database.Database,
  input: Parameters<DiscoveryRepository["recordPage"]>[0],
): RecordedDiscoveryPage {
  return database.transaction(() => {
    const existing = database
      .prepare(
        `select more_results from discovery_queries
         where run_id = ? and query_text = ? and page_offset = ?`,
      )
      .get(input.runId, input.query, input.offset) as { more_results: number } | undefined
    if (existing) {
      return { uniqueAdded: 0, duplicates: 0, progress: readProgress(database, input.runId) }
    }

    const queryId = crypto.randomUUID()
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
    const occurrences: Array<{
      businessId: string
      duplicate: boolean
      result: (typeof input.page.results)[number]
    }> = []

    for (const result of input.page.results) {
      const resultUrl = normalizeDiscoveryUrl(result.url)
      if (!resultUrl) continue
      const discoveryKey = `${input.source}:${resultUrl}`
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
              result_url, description, raw_attributes, discovery_rank, discovered_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            businessId,
            input.runId,
            input.source,
            result.sourceIdentifier,
            discoveryKey,
            result.title,
            normalizeBusinessName(result.title),
            resultUrl,
            result.description ?? null,
            JSON.stringify(result.attributes),
            nextRank,
            input.recordedAt.getTime(),
          )
        nextRank += 1
        uniqueAdded += 1
      }
      occurrences.push({
        businessId,
        duplicate: Boolean(existingBusiness),
        result: { ...result, url: resultUrl },
      })
    }

    database
      .prepare(
        `insert into discovery_queries
         (id, run_id, task_id, source, query_text, page_offset, result_count, unique_count,
          duplicate_count, more_results, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        queryId,
        input.runId,
        input.taskId,
        input.source,
        input.query,
        input.offset,
        input.page.results.length,
        uniqueAdded,
        duplicates,
        input.page.moreResults ? 1 : 0,
        input.recordedAt.getTime(),
      )

    const insertOccurrence = database.prepare(
      `insert into discovery_occurrences
       (id, run_id, query_id, business_id, source_identifier, result_url, duplicate_input,
        raw_attributes, discovered_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertEvent = database.prepare(
      `insert into technical_run_events
       (id, run_id, task_id, business_id, kind, source_identifier, result_url, message,
        details, schema_version, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    for (const occurrence of occurrences) {
      insertOccurrence.run(
        crypto.randomUUID(),
        input.runId,
        queryId,
        occurrence.businessId,
        occurrence.result.sourceIdentifier,
        occurrence.result.url,
        occurrence.duplicate ? 1 : 0,
        JSON.stringify(occurrence.result.attributes),
        input.recordedAt.getTime(),
      )
      insertEvent.run(
        crypto.randomUUID(),
        input.runId,
        input.taskId,
        occurrence.businessId,
        "DiscoveryResult",
        occurrence.result.sourceIdentifier,
        occurrence.result.url,
        occurrence.duplicate
          ? "Web-search result matched an earlier discovery input."
          : "Web-search result created a discovery input.",
        JSON.stringify({
          query: input.query,
          offset: input.offset,
          duplicateInput: occurrence.duplicate,
        }),
        input.recordedAt.getTime(),
      )
    }
    insertEvent.run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      null,
      "DiscoveryQuery",
      input.source,
      null,
      "A bounded subscription-runtime web search completed.",
      JSON.stringify({
        query: input.query,
        offset: input.offset,
        resultCount: input.page.results.length,
        uniqueAdded,
        duplicates,
        moreResults: input.page.moreResults,
      }),
      input.recordedAt.getTime(),
    )

    const progress = readProgress(database, input.runId)
    database
      .prepare(
        `update run_metrics set queries = queries + 1, discoveries = ?,
         duplicates = duplicates + ?, updated_at = ?, version = version + 1
         where run_id = ?`,
      )
      .run(progress.uniqueBusinesses, duplicates, input.recordedAt.getTime(), input.runId)
    return { uniqueAdded, duplicates, progress }
  })()
}

function readProgress(database: Database.Database, runId: string): DiscoveryProgress {
  const businessIds = database
    .prepare(
      "select id from discovered_businesses where run_id = ? order by discovery_rank, discovered_at, id",
    )
    .all(runId) as readonly { id: string }[]
  return { uniqueBusinesses: businessIds.length, businessIds: businessIds.map((row) => row.id) }
}
