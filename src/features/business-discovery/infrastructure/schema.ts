import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

import { prospectingRuns } from "@/features/prospecting-runs"
import { runTasks } from "@/features/run-execution"

export const discoveryQueries = sqliteTable(
  "discovery_queries",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => runTasks.id, { onDelete: "set null" }),
    source: text().notNull(),
    queryText: text("query_text").notNull(),
    pageOffset: integer("page_offset").notNull(),
    resultCount: integer("result_count").notNull(),
    uniqueCount: integer("unique_count").notNull(),
    duplicateCount: integer("duplicate_count").notNull(),
    moreResults: integer("more_results", { mode: "boolean" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("discovery_queries_run_query_page_idx").on(
      table.runId,
      table.queryText,
      table.pageOffset,
    ),
    index("discovery_queries_run_idx").on(table.runId, table.completedAt),
  ],
)

export const discoveredBusinesses = sqliteTable(
  "discovered_businesses",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    source: text().notNull(),
    sourceIdentifier: text("source_identifier").notNull(),
    discoveryKey: text("discovery_key").notNull(),
    name: text().notNull(),
    normalizedName: text("normalized_name").notNull(),
    resultUrl: text("result_url").notNull(),
    description: text(),
    rawAttributes: text("raw_attributes").notNull(),
    // A page shares one `discovered_at`, so without this the only tiebreak is the random primary key.
    discoveryRank: integer("discovery_rank").notNull().default(0),
    discoveredAt: integer("discovered_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("discovered_businesses_run_key_idx").on(table.runId, table.discoveryKey),
    index("discovered_businesses_run_idx").on(table.runId, table.discoveredAt),
    index("discovered_businesses_run_rank_idx").on(table.runId, table.discoveryRank),
  ],
)

export const discoveryOccurrences = sqliteTable(
  "discovery_occurrences",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    queryId: text("query_id")
      .notNull()
      .references(() => discoveryQueries.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => discoveredBusinesses.id, { onDelete: "cascade" }),
    sourceIdentifier: text("source_identifier").notNull(),
    resultUrl: text("result_url").notNull(),
    duplicateInput: integer("duplicate_input", { mode: "boolean" }).notNull(),
    rawAttributes: text("raw_attributes").notNull(),
    discoveredAt: integer("discovered_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("discovery_occurrences_run_idx").on(table.runId, table.discoveredAt)],
)
