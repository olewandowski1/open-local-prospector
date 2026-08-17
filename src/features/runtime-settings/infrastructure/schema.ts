import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const runtimePreferences = sqliteTable("runtime_preferences", {
  key: text().primaryKey(),
  runtimeId: text("runtime_id").notNull(),
  model: text(),
  reasoningEffort: text("reasoning_effort"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
