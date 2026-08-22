import type Database from "better-sqlite3"
import { Effect } from "effect"
import type {
  CommittedIdentity,
  IdentityRepository,
  IdentityTaskContext,
} from "@/features/business-identity/application/identity-repository"
import { IdentityPersistenceError } from "@/features/business-identity/application/identity-repository"
import type {
  IdentityEvaluation,
  IdentityEvidence,
} from "@/features/business-identity/domain/business-identity"
import { sharedDatabase } from "@/features/local-application"
import type { SearchBrief } from "@/features/prospecting-runs"

type DiscoveredRow = Readonly<{
  id: string
  name: string
  result_url: string
  description: string | null
  source_identifier: string
  discovered_at: number
  search_brief: string
}>

export function makeSqliteIdentityRepository(databasePath: string): IdentityRepository {
  return {
    loadContext: (runId, discoveredBusinessId) =>
      databaseEffect(databasePath, "load", (database) =>
        loadContext(database, runId, discoveredBusinessId),
      ),
    hasCompletedQuery: (runId, discoveredBusinessId, query) =>
      databaseEffect(databasePath, "lookup-query", (database) =>
        Boolean(
          database
            .prepare(
              `select 1 from identity_evidence_queries
               where run_id = ? and discovered_business_id = ? and query_text = ?`,
            )
            .get(runId, discoveredBusinessId, query),
        ),
      ),
    recordEvidenceQuery: (input) =>
      databaseEffect(databasePath, "record-query", (database) =>
        recordEvidenceQuery(database, input),
      ),
    commitEvaluation: (input) =>
      databaseEffect(databasePath, "commit", (database) => commitEvaluation(database, input)),
  }
}

function databaseEffect<A>(
  databasePath: string,
  operation: IdentityPersistenceError["operation"],
  use: (database: Database.Database) => A,
) {
  return Effect.try({
    try: () => use(sharedDatabase(databasePath)),
    catch: () => new IdentityPersistenceError({ operation }),
  })
}

function loadContext(
  database: Database.Database,
  runId: string,
  discoveredBusinessId: string,
): IdentityTaskContext {
  const row = database
    .prepare(
      `select d.id, d.name, d.result_url, d.description, d.source_identifier, d.discovered_at,
       r.search_brief
       from discovered_businesses d join prospecting_runs r on r.id = d.run_id
       where d.id = ? and d.run_id = ?`,
    )
    .get(discoveredBusinessId, runId) as DiscoveredRow | undefined
  if (!row) throw new Error("discovered business missing")
  const additional = database
    .prepare(
      `select source_identifier, title, result_url, description, collected_at
       from identity_evidence_results where run_id = ? and discovered_business_id = ?
       order by collected_at, id`,
    )
    .all(runId, discoveredBusinessId) as readonly {
    source_identifier: string
    title: string
    result_url: string
    description: string | null
    collected_at: number
  }[]
  const evidence: IdentityEvidence[] = [
    {
      sourceIdentifier: row.source_identifier,
      title: row.name,
      url: row.result_url,
      ...(row.description ? { description: row.description } : {}),
      collectedAt: new Date(row.discovered_at),
    },
    ...additional.map((item) => ({
      sourceIdentifier: item.source_identifier,
      title: item.title,
      url: item.result_url,
      ...(item.description ? { description: item.description } : {}),
      collectedAt: new Date(item.collected_at),
    })),
  ]
  return {
    discoveredBusinessId: row.id,
    name: row.name,
    resultUrl: row.result_url,
    ...(row.description ? { description: row.description } : {}),
    searchBrief: JSON.parse(row.search_brief) as SearchBrief,
    evidence,
  }
}

function recordEvidenceQuery(
  database: Database.Database,
  input: Parameters<IdentityRepository["recordEvidenceQuery"]>[0],
): void {
  database.transaction(() => {
    const existing = database
      .prepare(
        `select 1 from identity_evidence_queries
         where run_id = ? and discovered_business_id = ? and query_text = ?`,
      )
      .get(input.runId, input.discoveredBusinessId, input.query)
    if (existing) return
    const queryId = crypto.randomUUID()
    database
      .prepare(
        `insert into identity_evidence_queries
         (id, run_id, task_id, discovered_business_id, source, query_text, result_count, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        queryId,
        input.runId,
        input.taskId,
        input.discoveredBusinessId,
        input.source,
        input.query,
        input.page.results.length,
        input.collectedAt.getTime(),
      )
    const insertResult = database.prepare(
      `insert into identity_evidence_results
       (id, query_id, run_id, discovered_business_id, source_identifier, title, result_url,
        description, collected_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertEvent = database.prepare(
      `insert into technical_run_events
       (id, run_id, task_id, business_id, kind, source_identifier, result_url, message,
        details, schema_version, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    for (const result of input.page.results) {
      insertResult.run(
        crypto.randomUUID(),
        queryId,
        input.runId,
        input.discoveredBusinessId,
        result.sourceIdentifier,
        result.title,
        result.url,
        result.description ?? null,
        input.collectedAt.getTime(),
      )
      insertEvent.run(
        crypto.randomUUID(),
        input.runId,
        input.taskId,
        input.discoveredBusinessId,
        "IdentitySourceResult",
        result.sourceIdentifier,
        result.url,
        "A public result was retained as identity evidence text.",
        JSON.stringify({ query: input.query }),
        input.collectedAt.getTime(),
      )
    }
    insertEvent.run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      input.discoveredBusinessId,
      "IdentityQuery",
      input.source,
      null,
      "A bounded public identity-evidence query completed.",
      JSON.stringify({ query: input.query, resultCount: input.page.results.length }),
      input.collectedAt.getTime(),
    )
    database
      .prepare(
        `update run_metrics set queries = queries + 1, updated_at = ?, version = version + 1
         where run_id = ?`,
      )
      .run(input.collectedAt.getTime(), input.runId)
  })()
}

function commitEvaluation(
  database: Database.Database,
  input: Parameters<IdentityRepository["commitEvaluation"]>[0],
): CommittedIdentity {
  return database.transaction(() => {
    const canonicalBusinessId = input.evaluation.canonicalFingerprint
      ? upsertCanonical(database, input.evaluation, input.searchBrief, input.committedAt)
      : undefined
    const previousAssessment = canonicalBusinessId
      ? (database
          .prepare("select last_assessed_at from canonical_businesses where id = ?")
          .pluck()
          .get(canonicalBusinessId) as number | null)
      : null
    const recentlyAssessed =
      previousAssessment !== null &&
      previousAssessment >= input.committedAt.getTime() - 30 * 24 * 60 * 60 * 1_000
    const policy = input.searchBrief.recentBusinessPolicy ?? "Skip"
    const suppressed = input.evaluation.canonicalFingerprint
      ? Boolean(
          database
            .prepare("select 1 from suppression_entries where identity_fingerprint = ?")
            .get(input.evaluation.canonicalFingerprint),
        )
      : false
    // Several discovered pages routinely corroborate to one business; without this each becomes its own candidate.
    const duplicateOf = canonicalBusinessId
      ? (database
          .prepare(
            `select id from run_businesses
             where run_id = ? and canonical_business_id = ? and discovered_business_id <> ?
             order by created_at, id limit 1`,
          )
          .pluck()
          .get(input.runId, canonicalBusinessId, input.discoveredBusinessId) as string | undefined)
      : undefined
    const status: CommittedIdentity["status"] =
      input.evaluation.status !== "Eligible"
        ? input.evaluation.status
        : suppressed
          ? "Excluded"
          : duplicateOf
            ? "DuplicateCandidate"
            : recentlyAssessed && policy === "Skip"
              ? "SkippedRecent"
              : recentlyAssessed && policy === "IncludeWithoutReassessment"
                ? "IncludedRecent"
                : "Eligible"
    const runBusinessId = upsertRunBusiness(
      database,
      input,
      canonicalBusinessId,
      status,
      duplicateOf && status === "DuplicateCandidate"
        ? "Already discovered in this run under another listing."
        : undefined,
    )
    replacePresences(database, runBusinessId, canonicalBusinessId, input.evaluation)
    if (canonicalBusinessId) {
      replaceContacts(database, runBusinessId, canonicalBusinessId, input.evaluation)
    }
    updateExclusionMetrics(database, input.runId, input.committedAt)
    recordDecisionEvent(database, input, runBusinessId, status)
    const websiteUrl = input.evaluation.presences.find(
      (presence) => presence.type === "Website" && presence.associationState === "Confirmed",
    )?.url
    return {
      runBusinessId,
      ...(canonicalBusinessId ? { canonicalBusinessId } : {}),
      status,
      ...(websiteUrl ? { websiteUrl } : {}),
      shouldInspect: status === "Eligible" && Boolean(canonicalBusinessId),
    }
  })()
}

function upsertCanonical(
  database: Database.Database,
  evaluation: IdentityEvaluation,
  searchBrief: SearchBrief,
  now: Date,
): string {
  const fingerprint = evaluation.canonicalFingerprint
  if (!fingerprint) throw new Error("canonical fingerprint missing")
  const existing = database
    .prepare("select id from canonical_businesses where identity_fingerprint = ?")
    .get(fingerprint) as { id: string } | undefined
  const locality = searchBrief.searchArea.displayName.split(",")[0]?.trim() ?? searchBrief.location
  const normalizedName = normalizeCanonicalName(evaluation.canonicalName)
  // A rediscovered business can key on a different signal, so name and locality also match.
  const established =
    existing ??
    (normalizedName.length >= 3
      ? (database
          .prepare(
            `select id from canonical_businesses
             where normalized_name = ? and country_code = ? and lower(locality) = lower(?)
             order by created_at, id limit 1`,
          )
          .get(normalizedName, searchBrief.searchArea.countryCode, locality) as
          | { id: string }
          | undefined)
      : undefined)
  if (established) return established.id
  const id = crypto.randomUUID()
  // The first corroborated name is already shown against every candidate, so a later listing never renames it.
  database
    .prepare(
      `insert into canonical_businesses
       (id, identity_fingerprint, name, normalized_name, locality, country_code, decision_scope,
        created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(identity_fingerprint) do update set
        decision_scope = excluded.decision_scope, updated_at = excluded.updated_at`,
    )
    .run(
      id,
      fingerprint,
      evaluation.canonicalName,
      normalizedName,
      locality,
      searchBrief.searchArea.countryCode,
      evaluation.decisionScope,
      now.getTime(),
      now.getTime(),
    )
  return id
}

function normalizeCanonicalName(name: string): string {
  return name.toLocaleLowerCase("pl").replace(/\s+/gu, " ").trim()
}

function upsertRunBusiness(
  database: Database.Database,
  input: Parameters<IdentityRepository["commitEvaluation"]>[0],
  canonicalBusinessId: string | undefined,
  status: CommittedIdentity["status"],
  exclusionReason?: string,
): string {
  const existing = database
    .prepare("select id from run_businesses where run_id = ? and discovered_business_id = ?")
    .get(input.runId, input.discoveredBusinessId) as { id: string } | undefined
  const id = existing?.id ?? crypto.randomUUID()
  database
    .prepare(
      `insert into run_businesses
       (id, run_id, discovered_business_id, canonical_business_id, status, identity_confidence,
        exclusion_code, exclusion_reason, signals, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(run_id, discovered_business_id) do update set
        canonical_business_id = excluded.canonical_business_id, status = excluded.status,
        identity_confidence = excluded.identity_confidence, exclusion_code = excluded.exclusion_code,
        exclusion_reason = excluded.exclusion_reason, signals = excluded.signals,
        updated_at = excluded.updated_at`,
    )
    .run(
      id,
      input.runId,
      input.discoveredBusinessId,
      canonicalBusinessId ?? null,
      status,
      input.evaluation.status === "Ambiguous" ? "Ambiguous" : "Corroborated",
      input.evaluation.exclusionCode ?? (exclusionReason ? "duplicate-candidate" : null),
      exclusionReason ?? input.evaluation.exclusionReason ?? null,
      JSON.stringify(input.evaluation.signals),
      input.committedAt.getTime(),
      input.committedAt.getTime(),
    )
  return id
}

function replacePresences(
  database: Database.Database,
  runBusinessId: string,
  canonicalBusinessId: string | undefined,
  evaluation: IdentityEvaluation,
): void {
  database.prepare("delete from online_presences where run_business_id = ?").run(runBusinessId)
  const insert = database.prepare(
    `insert into online_presences
     (id, canonical_business_id, run_business_id, type, url, source_identifier,
      association_state, collected_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const presence of evaluation.presences) {
    insert.run(
      crypto.randomUUID(),
      canonicalBusinessId ?? null,
      runBusinessId,
      presence.type,
      presence.url,
      presence.sourceIdentifier,
      presence.associationState,
      presence.collectedAt.getTime(),
    )
  }
}

function replaceContacts(
  database: Database.Database,
  runBusinessId: string,
  canonicalBusinessId: string,
  evaluation: IdentityEvaluation,
): void {
  database.prepare("delete from contact_routes where run_business_id = ?").run(runBusinessId)
  const insert = database.prepare(
    `insert into contact_routes
     (id, canonical_business_id, run_business_id, type, value, source_url, collected_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const contact of evaluation.contacts) {
    insert.run(
      crypto.randomUUID(),
      canonicalBusinessId,
      runBusinessId,
      contact.type,
      contact.value,
      contact.sourceUrl,
      contact.collectedAt.getTime(),
    )
  }
}

function updateExclusionMetrics(database: Database.Database, runId: string, now: Date): void {
  const exclusions = Number(
    database
      .prepare(
        `select count(*) from run_businesses
         where run_id = ?
         and status in ('Ambiguous', 'Excluded', 'SkippedRecent', 'DuplicateCandidate')`,
      )
      .pluck()
      .get(runId),
  )
  database
    .prepare(
      `update run_metrics set exclusions = ?, updated_at = ?, version = version + 1
       where run_id = ?`,
    )
    .run(exclusions, now.getTime(), runId)
}

function recordDecisionEvent(
  database: Database.Database,
  input: Parameters<IdentityRepository["commitEvaluation"]>[0],
  runBusinessId: string,
  status: CommittedIdentity["status"],
): void {
  database
    .prepare(
      `insert into technical_run_events
       (id, run_id, task_id, business_id, kind, source_identifier, result_url, message,
        details, schema_version, created_at)
       values (?, ?, ?, ?, 'IdentityDecision', ?, null, ?, ?, 1, ?)`,
    )
    .run(
      crypto.randomUUID(),
      input.runId,
      input.taskId,
      input.discoveredBusinessId,
      runBusinessId,
      status === "Eligible"
        ? "Public signals corroborated a locally controlled business identity."
        : "Public signals produced a retained identity or eligibility decision.",
      JSON.stringify({
        status,
        signals: input.evaluation.signals,
        exclusionCode: input.evaluation.exclusionCode ?? null,
      }),
      input.committedAt.getTime(),
    )
}
