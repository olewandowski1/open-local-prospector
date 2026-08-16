import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const prospectingRuns = sqliteTable("prospecting_runs", {
  id: text().primaryKey(),
  requestId: text("request_id").notNull().unique(),
  state: text().notNull(),
  searchBrief: text("search_brief").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const prospectingDefaults = sqliteTable("prospecting_defaults", {
  key: text().primaryKey(),
  radiusKm: integer("radius_km"),
  category: text().notNull(),
  targetCount: integer("target_count").notNull(),
  mode: text().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const geocodingCache = sqliteTable("geocoding_cache", {
  query: text().primaryKey(),
  results: text().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
})
