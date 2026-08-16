import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { prospectingRuns } from "@/features/prospecting-runs"
import { runTasks } from "@/features/run-execution"

export const runMetrics = sqliteTable("run_metrics", {
  runId: text("run_id")
    .primaryKey()
    .references(() => prospectingRuns.id, { onDelete: "cascade" }),
  queries: integer().notNull().default(0),
  discoveries: integer().notNull().default(0),
  duplicates: integer().notNull().default(0),
  exclusions: integer().notNull().default(0),
  websites: integer().notNull().default(0),
  assessments: integer().notNull().default(0),
  qualifiedCandidates: integer("qualified_candidates").notNull().default(0),
  blockedInspections: integer("blocked_inspections").notNull().default(0),
  targetRemaining: integer("target_remaining").notNull().default(0),
  version: integer().notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const technicalRunEvents = sqliteTable(
  "technical_run_events",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => runTasks.id, { onDelete: "set null" }),
    businessId: text("business_id"),
    kind: text().notNull(),
    sourceIdentifier: text("source_identifier"),
    resultUrl: text("result_url"),
    message: text().notNull(),
    details: text().notNull().default("{}"),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("technical_run_events_run_idx").on(table.runId, table.createdAt)],
)
