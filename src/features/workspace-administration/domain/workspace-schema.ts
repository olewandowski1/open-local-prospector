export const PROSPECTING_DATA_TABLES = [
  "supporting_observations",
  "website_opportunities",
  "candidate_corrections",
  "candidate_reviews",
  "candidate_scores",
  "website_assessments",
  "inspection_artifacts",
  "inspection_blocks",
  "inspection_pages",
  "website_inspections",
  "contact_routes",
  "online_presences",
  "identity_evidence_results",
  "identity_evidence_queries",
  "run_businesses",
  "canonical_businesses",
  "discovery_occurrences",
  "discovered_businesses",
  "discovery_reports",
  "discovery_queries",
  "technical_run_events",
  "run_metrics",
  "run_transitions",
  "run_tasks",
  "prospecting_runs",
] as const

export const PREFERENCE_TABLES = [
  "runtime_preferences",
  "prospecting_defaults",
  "local_preferences",
  "geocoding_cache",
] as const

export const SUPPRESSION_TABLES = ["suppression_entries"] as const
export const BOOKKEEPING_TABLES = ["__drizzle_migrations"] as const

export const CLASSIFIED_WORKSPACE_TABLES = [
  ...PROSPECTING_DATA_TABLES,
  ...PREFERENCE_TABLES,
  ...SUPPRESSION_TABLES,
] as const

export type WorkspaceTableName = (typeof CLASSIFIED_WORKSPACE_TABLES)[number]

export function unclassifiedWorkspaceTables(actualTables: readonly string[]): readonly string[] {
  const classified = new Set<string>([...CLASSIFIED_WORKSPACE_TABLES, ...BOOKKEEPING_TABLES])
  return actualTables.filter((table) => !classified.has(table)).toSorted()
}
