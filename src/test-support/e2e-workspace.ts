import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import Database from "better-sqlite3"

import { migrateLocalDatabase } from "@/features/local-application"

/** Seed invented businesses so browser tests never expose real contact data. */
export function seedE2eWorkspace(
  databasePath: string,
  artifactsPath = join(dirname(databasePath), "artifacts"),
): void {
  mkdirSync(artifactsPath, { recursive: true })
  migrateLocalDatabase(databasePath)
  const database = new Database(databasePath)
  try {
    database.pragma("foreign_keys = ON")
    database.transaction(() => {
      clear(database)
      for (const [index, run] of RUNS.entries()) writeRun(database, run, index, artifactsPath)
    })()
  } finally {
    database.close()
  }
}

type SeedBusiness = Readonly<{
  name: string
  locality: string
  telephone: string
  website?: string
  score?: number
  opportunity?: string
  blocked?: boolean
}>

type SeedRun = Readonly<{
  key: string
  category: string
  locality: string
  latitude: number
  longitude: number
  state: "Completed" | "Running"
  completion?: string
  stage: string
  businesses: readonly SeedBusiness[]
}>

const RUNS: readonly SeedRun[] = [
  {
    key: "reda-florist",
    category: "Florist",
    locality: "Reda",
    latitude: 54.6053,
    longitude: 18.3472,
    state: "Completed",
    completion: "Target Reached",
    stage: "ScoreCandidate",
    businesses: [
      {
        name: "Amber Bloom Florist",
        locality: "Reda",
        telephone: "+48511000001",
        score: 88,
        opportunity: "NoDedicatedWebsite",
      },
      {
        name: "Willow And Stem",
        locality: "Reda",
        telephone: "+48511000002",
        website: "https://example.test/willow-and-stem",
        score: 74.5,
        opportunity: "BrokenOrUnusable",
      },
      {
        name: "Meadow Petals",
        locality: "Reda",
        telephone: "+48511000003",
        score: 66.25,
        opportunity: "WeakDiscoverability",
      },
      { name: "Coastal Flowers", locality: "Reda", telephone: "+48511000004", blocked: true },
    ],
  },
  {
    key: "rumia-florist",
    category: "Florist",
    locality: "Rumia",
    latitude: 54.5709,
    longitude: 18.388,
    state: "Completed",
    completion: "Search Exhausted",
    stage: "ScoreCandidate",
    businesses: [
      {
        name: "Harbour Bloom Florist",
        locality: "Rumia",
        telephone: "+48512000001",
        score: 81.75,
        opportunity: "NoDedicatedWebsite",
      },
      {
        name: "North Garden Flowers",
        locality: "Rumia",
        telephone: "+48512000002",
        score: 62.5,
        opportunity: "MobileAccessibilityOrPerformance",
      },
    ],
  },
  {
    key: "rumia-florist-running",
    category: "Florist",
    locality: "Rumia",
    latitude: 54.5709,
    longitude: 18.388,
    state: "Running",
    stage: "InspectWebsite",
    businesses: [
      { name: "Moss And Rose", locality: "Rumia", telephone: "+48513000001" },
      { name: "Bluebell Studio", locality: "Rumia", telephone: "+48513000002" },
    ],
  },
]

const TABLES = [
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
]

function clear(database: Database.Database): void {
  database.pragma("foreign_keys = OFF")
  for (const table of TABLES) database.prepare(`delete from "${table}"`).run()
  database.pragma("foreign_keys = ON")
}

function writeRun(
  database: Database.Database,
  run: SeedRun,
  runIndex: number,
  artifactsPath: string,
): void {
  // Fixed clock: a spec that asserts on "12 Minutes Ago" must not depend on when it runs.
  const base = Date.UTC(2026, 7, 20, 9, 0, 0) + runIndex * 3_600_000
  const runId = id(`run-${run.key}`)
  const searchBrief = {
    location: run.locality,
    category: run.category,
    targetCount: 5,
    mode: "Quick",
    runtime: "claude",
    runtimeConfiguration: { model: "claude-sonnet-5", reasoningEffort: "high" },
    searchArea: {
      id: `relation:${900000 + runIndex}`,
      displayName: `${run.locality}, Poland`,
      latitude: run.latitude,
      longitude: run.longitude,
      countryCode: "PL",
    },
  }
  const qualified = run.businesses.filter((business) => (business.score ?? 0) >= 60).length

  database
    .prepare(
      `insert into prospecting_runs
       (id, request_id, search_brief, state, completion_state, current_stage, requested_control,
        version, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'None', 1, ?, ?)`,
    )
    .run(
      runId,
      `e2e-${run.key}`,
      JSON.stringify(searchBrief),
      run.state,
      run.completion ?? null,
      run.stage,
      base,
      base + 600_000,
    )

  // A trigger creates the metrics row with the run, so this fills it in rather than adding one.
  database
    .prepare(
      `update run_metrics set queries = 1, discoveries = ?, websites = ?, assessments = ?,
       qualified_candidates = ?, blocked_inspections = ?, target_remaining = ?, updated_at = ?
       where run_id = ?`,
    )
    .run(
      run.businesses.length,
      run.businesses.filter((business) => business.website).length,
      run.businesses.filter((business) => business.score !== undefined).length,
      qualified,
      run.businesses.filter((business) => business.blocked).length,
      Math.max(0, 5 - qualified),
      base + 600_000,
      runId,
    )

  const taskId = id(`task-${run.key}`)
  database
    .prepare(
      `insert into run_tasks
       (id, run_id, stage, status, attempt_count, max_attempts, input, schema_version, version,
        available_at, created_at, updated_at)
       values (?, ?, ?, 'Completed', 1, 3, '{}', 1, 1, ?, ?, ?)`,
    )
    .run(taskId, runId, run.stage, base, base, base + 600_000)

  database
    .prepare(
      `insert into technical_run_events
       (id, run_id, task_id, kind, source_identifier, message, details, schema_version, created_at)
       values (?, ?, ?, 'DiscoveryQuery', 'fixture', ?, '{}', 1, ?)`,
    )
    .run(
      id(`event-${run.key}`),
      runId,
      taskId,
      "A bounded public search was reported and structured into businesses.",
      base + 60_000,
    )

  for (const [index, business] of run.businesses.entries()) {
    writeBusiness(database, { runId, run, business, index, base, artifactsPath })
  }
}

function writeBusiness(
  database: Database.Database,
  context: {
    runId: string
    run: SeedRun
    business: SeedBusiness
    index: number
    base: number
    artifactsPath: string
  },
): void {
  const { runId, run, business, index, base, artifactsPath } = context
  const slug = `${run.key}-${index}`
  const taskId = id(`task-${slug}`)
  const discoveredId = id(`discovered-${slug}`)
  const canonicalId = id(`canonical-${slug}`)
  const runBusinessId = id(`run-business-${slug}`)
  const at = base + 120_000 + index * 30_000
  const url = business.website ?? `https://example.test/${slug}`

  // An inspection, an assessment and a score are each unique per task, so every business gets one.
  database
    .prepare(
      `insert into run_tasks
       (id, run_id, stage, status, attempt_count, max_attempts, input, schema_version, version,
        available_at, created_at, updated_at)
       values (?, ?, 'ScoreCandidate', 'Completed', 1, 3, '{}', 1, 1, ?, ?, ?)`,
    )
    .run(taskId, runId, at, at, at)

  database
    .prepare(
      `insert into discovered_businesses
       (id, run_id, source, source_identifier, discovery_key, name, normalized_name, result_url,
        raw_attributes, structured, discovery_rank, discovered_at)
       values (?, ?, 'fixture', ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
    )
    .run(
      discoveredId,
      runId,
      url,
      `fixture:${slug}`,
      business.name,
      business.name.toLocaleLowerCase("pl"),
      url,
      JSON.stringify({
        name: business.name,
        locality: business.locality,
        decisionScope: "Local",
        centrallyControlled: false,
        onlineOnly: false,
        ...(business.website ? { websiteUrl: business.website } : {}),
        sourceUrls: [url],
        presences: [{ type: business.website ? "Website" : "Directory", url }],
        contacts: [{ type: "BusinessTelephone", value: business.telephone, sourceUrl: url }],
      }),
      index + 1,
      at,
    )

  database
    .prepare(
      `insert into canonical_businesses
       (id, identity_fingerprint, name, normalized_name, locality, country_code, decision_scope,
        last_assessed_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'PL', 'Local', ?, ?, ?)`,
    )
    .run(
      canonicalId,
      `tel:${business.telephone}|PL`,
      business.name,
      business.name.toLocaleLowerCase("pl"),
      business.locality,
      business.score === undefined ? null : at,
      at,
      at,
    )

  database
    .prepare(
      `insert into run_businesses
       (id, run_id, discovered_business_id, canonical_business_id, status, identity_confidence,
        signals, created_at, updated_at)
       values (?, ?, ?, ?, ?, 0.9, '["StructuredAttribution"]', ?, ?)`,
    )
    .run(
      runBusinessId,
      runId,
      discoveredId,
      canonicalId,
      business.score === undefined ? "Eligible" : "Candidate",
      at,
      at,
    )

  database
    .prepare(
      `insert into contact_routes
       (id, canonical_business_id, run_business_id, type, value, source_url, collected_at)
       values (?, ?, ?, 'BusinessTelephone', ?, ?, ?)`,
    )
    .run(id(`contact-${slug}`), canonicalId, runBusinessId, business.telephone, url, at)

  database
    .prepare(
      `insert into online_presences
       (id, canonical_business_id, run_business_id, type, url, source_identifier,
        association_state, collected_at)
       values (?, ?, ?, ?, ?, ?, 'Confirmed', ?)`,
    )
    .run(
      id(`presence-${slug}`),
      canonicalId,
      runBusinessId,
      business.website ? "Website" : "Directory",
      url,
      url,
      at,
    )

  const inspectionId = id(`inspection-${slug}`)
  database
    .prepare(
      `insert into website_inspections
       (id, run_id, task_id, run_business_id, canonical_business_id, status,
        configuration_version, started_at, completed_at)
       values (?, ?, ?, ?, ?, ?, 'quick-v1', ?, ?)`,
    )
    .run(
      inspectionId,
      runId,
      taskId,
      runBusinessId,
      canonicalId,
      business.blocked ? "Blocked" : business.website ? "Complete" : "NoWebsite",
      at,
      at + 20_000,
    )

  if (business.blocked) {
    database
      .prepare(
        `insert into inspection_blocks (id, inspection_id, code, url, message, recorded_at)
         values (?, ?, 'captcha', ?, ?, ?)`,
      )
      .run(
        id(`block-${slug}`),
        inspectionId,
        url,
        "A verification challenge was recorded rather than bypassed.",
        at + 20_000,
      )
    return
  }
  if (business.score === undefined) return

  if (business.website) {
    const pageId = id(`inspection-page-${slug}`)
    const artifactId = id(`inspection-artifact-${slug}`)
    const screenshot = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xc8WAAAAAElFTkSuQmCC",
      "base64",
    )
    const screenshotPath = join(artifactsPath, `${artifactId}.png`)
    writeFileSync(screenshotPath, screenshot)
    database
      .prepare(
        `insert into inspection_pages
         (id,inspection_id,sequence,viewport,requested_url,final_url,title,rendered_text,links,
          forms,console_failures,network_failures,measurements,captured_at)
         values (?,?,0,'Desktop',?,?,?,'Synthetic website evidence.','[]','[]','[]','[]',?,?)`,
      )
      .run(
        pageId,
        inspectionId,
        business.website,
        business.website,
        business.name,
        JSON.stringify({
          navigationDurationMs: 1234.56,
          firstContentfulPaintMs: 456.78,
          domNodes: 1234,
          headings: 4,
          links: 12,
          forms: 1,
          images: 8,
          imagesMissingAlt: 2,
          unlabeledControls: 1,
          horizontalOverflow: false,
          usesHttps: true,
        }),
        at + 15_000,
      )
    database
      .prepare(
        `insert into inspection_artifacts
         (id,inspection_id,page_id,kind,viewport,path,mime_type,byte_size,sha256,created_at)
         values (?,?,?,'Screenshot','Desktop',?,'image/png',?,?,?)`,
      )
      .run(
        artifactId,
        inspectionId,
        pageId,
        screenshotPath,
        screenshot.byteLength,
        createHash("sha256").update(screenshot).digest("hex"),
        at + 15_000,
      )
  }

  const assessmentId = id(`assessment-${slug}`)
  database
    .prepare(
      `insert into website_assessments
       (id, run_id, task_id, run_business_id, canonical_business_id, inspection_id, runtime_id,
        runtime_version, prompt_version, output_schema_version, inspection_configuration_version,
        assessment_state, summary, apparent_commercial_value, assessed_at)
       values (?, ?, ?, ?, ?, ?, 'claude', 'fixture', 'website-assessment-v3',
               'assessment-output-v1', 'quick-v1', 'Completed', ?, 0.5, ?)`,
    )
    .run(
      assessmentId,
      runId,
      taskId,
      runBusinessId,
      canonicalId,
      inspectionId,
      `${business.name} relies on a third-party listing rather than a site it controls.`,
      at + 40_000,
    )

  const opportunityId = id(`opportunity-${slug}`)
  database
    .prepare(
      `insert into website_opportunities
       (id, assessment_id, opportunity_class, severity, confidence, observable_effect,
        explanation, sequence)
       values (?, ?, ?, 4, 0.9, 'Discoverability', ?, 0)`,
    )
    .run(
      opportunityId,
      assessmentId,
      business.opportunity ?? "NoDedicatedWebsite",
      "Customers searching for this business reach a directory entry it cannot change.",
    )

  database
    .prepare(
      `insert into supporting_observations
       (id, opportunity_id, statement, source_url, observed_at, evidence_state, confidence, sequence)
       values (?, ?, ?, ?, ?, 'ConfirmedFact', 0.9, 0)`,
    )
    .run(
      id(`observation-${slug}`),
      opportunityId,
      `The listing at ${url} is the only public page found for ${business.name}.`,
      url,
      new Date(at).toISOString(),
    )

  const score = business.score
  database
    .prepare(
      `insert into candidate_scores
       (id, run_id, task_id, run_business_id, canonical_business_id, assessment_id, rubric_version,
        severity_component, confidence_component, contact_component, local_decision_component,
        commercial_value_component, total, qualified, scored_at)
       values (?, ?, ?, ?, ?, ?, 'opportunity-score-v2', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id(`score-${slug}`),
      runId,
      taskId,
      runBusinessId,
      canonicalId,
      assessmentId,
      score * 0.4,
      score * 0.25,
      score * 0.15,
      score * 0.1,
      score * 0.1,
      score,
      score >= 60 ? 1 : 0,
      at + 60_000,
    )
}

/** Stable ids keep a reseeded workspace byte-identical, so a failure is never yesterday's data. */
function id(seed: string): string {
  const digest = createHash("sha1").update(seed).digest("hex")
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-")
}
