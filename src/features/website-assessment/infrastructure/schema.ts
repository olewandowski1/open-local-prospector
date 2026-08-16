import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

import { canonicalBusinesses, runBusinesses } from "@/features/business-identity"
import { prospectingRuns } from "@/features/prospecting-runs"
import { runTasks } from "@/features/run-execution"

export const websiteAssessments = sqliteTable(
  "website_assessments",
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
    inspectionId: text("inspection_id").notNull(),
    runtimeId: text("runtime_id").notNull(),
    runtimeVersion: text("runtime_version"),
    promptVersion: text("prompt_version").notNull(),
    outputSchemaVersion: text("output_schema_version").notNull(),
    inspectionConfigurationVersion: text("inspection_configuration_version").notNull(),
    assessmentState: text("assessment_state").notNull(),
    summary: text().notNull(),
    apparentCommercialValue: real("apparent_commercial_value").notNull(),
    assessedAt: integer("assessed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("website_assessments_task_idx").on(table.taskId),
    index("website_assessments_business_idx").on(table.canonicalBusinessId, table.assessedAt),
  ],
)

export const websiteOpportunities = sqliteTable(
  "website_opportunities",
  {
    id: text().primaryKey(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => websiteAssessments.id, { onDelete: "cascade" }),
    opportunityClass: text("opportunity_class").notNull(),
    severity: integer().notNull(),
    confidence: real().notNull(),
    observableEffect: text("observable_effect").notNull(),
    explanation: text().notNull(),
    sequence: integer().notNull(),
  },
  (table) => [index("website_opportunities_assessment_idx").on(table.assessmentId, table.sequence)],
)

export const supportingObservations = sqliteTable(
  "supporting_observations",
  {
    id: text().primaryKey(),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => websiteOpportunities.id, { onDelete: "cascade" }),
    statement: text().notNull(),
    sourceUrl: text("source_url").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    evidenceState: text("evidence_state").notNull(),
    confidence: real().notNull(),
    sequence: integer().notNull(),
  },
  (table) => [
    index("supporting_observations_opportunity_idx").on(table.opportunityId, table.sequence),
  ],
)
