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

export const candidateReviews = sqliteTable("candidate_reviews", {
  id: text().primaryKey(),
  scoreId: text("score_id")
    .notNull()
    .references(() => candidateScores.id, { onDelete: "cascade" })
    .unique(),
  status: text().notNull().default("Unreviewed"),
  rejectionReason: text("rejection_reason"),
  rejectionNote: text("rejection_note"),
  privateNotes: text("private_notes").notNull().default(""),
  followUpAt: integer("follow_up_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const candidateCorrections = sqliteTable(
  "candidate_corrections",
  {
    id: text().primaryKey(),
    scoreId: text("score_id")
      .notNull()
      .references(() => candidateScores.id, { onDelete: "cascade" }),
    target: text().notNull(),
    correctedValue: text("corrected_value").notNull(),
    note: text().notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("candidate_corrections_history_idx").on(table.scoreId, table.createdAt)],
)
