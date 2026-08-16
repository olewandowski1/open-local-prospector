import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const localPreferences = sqliteTable("local_preferences", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
