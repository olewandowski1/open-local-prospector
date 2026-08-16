import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

import { canonicalBusinesses, runBusinesses } from "@/features/business-identity"
import { prospectingRuns } from "@/features/prospecting-runs"
import { runTasks } from "@/features/run-execution"

export const websiteInspections = sqliteTable(
  "website_inspections",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => runTasks.id, { onDelete: "cascade" }),
    runBusinessId: text("run_business_id")
      .notNull()
      .references(() => runBusinesses.id, { onDelete: "cascade" }),
    canonicalBusinessId: text("canonical_business_id")
      .notNull()
      .references(() => canonicalBusinesses.id, { onDelete: "cascade" }),
    status: text().notNull(),
    configurationVersion: text("configuration_version").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("website_inspections_task_idx").on(table.taskId),
    index("website_inspections_business_idx").on(table.canonicalBusinessId, table.completedAt),
  ],
)

export const inspectionPages = sqliteTable(
  "inspection_pages",
  {
    id: text().primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => websiteInspections.id, { onDelete: "cascade" }),
    sequence: integer().notNull(),
    viewport: text().notNull(),
    requestedUrl: text("requested_url").notNull(),
    finalUrl: text("final_url").notNull(),
    title: text().notNull(),
    description: text(),
    language: text(),
    renderedText: text("rendered_text").notNull(),
    links: text().notNull(),
    forms: text().notNull(),
    consoleFailures: text("console_failures").notNull(),
    networkFailures: text("network_failures").notNull(),
    measurements: text().notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("inspection_pages_inspection_idx").on(table.inspectionId, table.viewport, table.sequence),
  ],
)

export const inspectionArtifacts = sqliteTable(
  "inspection_artifacts",
  {
    id: text().primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => websiteInspections.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => inspectionPages.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    viewport: text().notNull(),
    path: text().notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("inspection_artifacts_inspection_idx").on(table.inspectionId, table.createdAt)],
)

export const inspectionBlocks = sqliteTable(
  "inspection_blocks",
  {
    id: text().primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => websiteInspections.id, { onDelete: "cascade" }),
    code: text().notNull(),
    url: text(),
    message: text().notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("inspection_blocks_inspection_idx").on(table.inspectionId, table.recordedAt)],
)
