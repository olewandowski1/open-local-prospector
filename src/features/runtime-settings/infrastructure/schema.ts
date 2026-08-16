import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const runtimePreferences = sqliteTable("runtime_preferences", {
  key: text().primaryKey(),
  runtimeId: text("runtime_id").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
