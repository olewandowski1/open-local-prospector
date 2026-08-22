import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

import { discoveredBusinesses } from "@/features/business-discovery"
import { prospectingRuns } from "@/features/prospecting-runs"

export const canonicalBusinesses = sqliteTable(
  "canonical_businesses",
  {
    id: text().primaryKey(),
    identityFingerprint: text("identity_fingerprint").notNull(),
    name: text().notNull(),
    normalizedName: text("normalized_name").notNull(),
    locality: text().notNull(),
    countryCode: text("country_code").notNull(),
    decisionScope: text("decision_scope").notNull(),
    lastAssessedAt: integer("last_assessed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("canonical_businesses_fingerprint_idx").on(table.identityFingerprint)],
)

export const runBusinesses = sqliteTable(
  "run_businesses",
  {
    id: text().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prospectingRuns.id, { onDelete: "cascade" }),
    discoveredBusinessId: text("discovered_business_id")
      .notNull()
      .references(() => discoveredBusinesses.id, { onDelete: "cascade" }),
    canonicalBusinessId: text("canonical_business_id").references(() => canonicalBusinesses.id, {
      onDelete: "set null",
    }),
    status: text().notNull(),
    identityConfidence: text("identity_confidence").notNull(),
    exclusionCode: text("exclusion_code"),
    exclusionReason: text("exclusion_reason"),
    signals: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("run_businesses_discovery_idx").on(table.runId, table.discoveredBusinessId),
    index("run_businesses_run_status_idx").on(table.runId, table.status),
  ],
)

export const onlinePresences = sqliteTable(
  "online_presences",
  {
    id: text().primaryKey(),
    canonicalBusinessId: text("canonical_business_id").references(() => canonicalBusinesses.id, {
      onDelete: "cascade",
    }),
    runBusinessId: text("run_business_id")
      .notNull()
      .references(() => runBusinesses.id, { onDelete: "cascade" }),
    type: text().notNull(),
    url: text().notNull(),
    sourceIdentifier: text("source_identifier").notNull(),
    associationState: text("association_state").notNull(),
    collectedAt: integer("collected_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("online_presences_run_url_idx").on(table.runBusinessId, table.url)],
)

export const contactRoutes = sqliteTable(
  "contact_routes",
  {
    id: text().primaryKey(),
    canonicalBusinessId: text("canonical_business_id")
      .notNull()
      .references(() => canonicalBusinesses.id, { onDelete: "cascade" }),
    runBusinessId: text("run_business_id")
      .notNull()
      .references(() => runBusinesses.id, { onDelete: "cascade" }),
    type: text().notNull(),
    value: text().notNull(),
    sourceUrl: text("source_url").notNull(),
    collectedAt: integer("collected_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("contact_routes_run_value_idx").on(table.runBusinessId, table.type, table.value),
  ],
)
