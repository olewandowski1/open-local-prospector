import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { prospectingRuns } from "@/features/prospecting-runs"

export const runTasks = sqliteTable(
  "run_tasks",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    businessId: text("business_id"),
    stage: text().notNull(),
    status: text().notNull().default("Pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull().default(sql`0`),
    input: text().notNull().default("{}"),
    checkpoint: text(),
    schemaVersion: integer("schema_version").notNull().default(1),
    version: integer().notNull().default(1),
    failure: text(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("run_tasks_claim_idx").on(table.status, table.availableAt, table.createdAt),
    index("run_tasks_run_idx").on(table.runId, table.status),
    check("run_tasks_attempt_count_check", sql`${table.attemptCount} >= 0`),
    check("run_tasks_max_attempts_check", sql`${table.maxAttempts} between 1 and 3`),
  ],
)

export const runTransitions = sqliteTable(
  "run_transitions",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => runTasks.id, { onDelete: "set null" }),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    event: text().notNull(),
    payload: text().notNull().default("{}"),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("run_transitions_run_idx").on(table.runId, table.createdAt)],
)
