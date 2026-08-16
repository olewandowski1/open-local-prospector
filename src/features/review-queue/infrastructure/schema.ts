import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { canonicalBusinesses, runBusinesses } from "@/features/business-identity"
import { prospectingRuns } from "@/features/prospecting-runs"
import { runTasks } from "@/features/run-execution"

export const candidateScores = sqliteTable(
  "candidate_scores",
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
    assessmentId: text("assessment_id").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    severityComponent: real("severity_component").notNull(),
    confidenceComponent: real("confidence_component").notNull(),
    contactComponent: real("contact_component").notNull(),
    localDecisionComponent: real("local_decision_component").notNull(),
    commercialValueComponent: real("commercial_value_component").notNull(),
    total: real().notNull(),
    qualified: integer({ mode: "boolean" }).notNull(),
    scoredAt: integer("scored_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("candidate_scores_task_idx").on(table.taskId),
    index("candidate_scores_rank_idx").on(table.qualified, table.total, table.scoredAt),
  ],
)
