import Database from "better-sqlite3"
import { Effect } from "effect"

import type {
  AssessmentRepository,
  AssessmentTarget,
} from "@/features/website-assessment/application/assessment-repository"
import { AssessmentPersistenceError } from "@/features/website-assessment/application/assessment-repository"
import {
  ASSESSMENT_PROMPT_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  type AssessmentOutput,
} from "@/features/website-assessment/domain/assessment-output"

type TargetRow = {
  id: string
  run_business_id: string
  canonical_business_id: string
  status: string
  configuration_version: string
  name: string
  locality: string
  search_brief: string
  has_contact: number
}
type PageRow = {
  final_url: string
  captured_at: number
  viewport: "Desktop" | "Mobile"
  title: string
  description: string | null
  rendered_text: string
  links: string
  forms: string
  console_failures: string
  network_failures: string
  measurements: string
}
type PresenceRow = {
  type: "Website" | "SocialProfile" | "Directory"
  url: string
  collected_at: number
}
type BlockRow = { code: string; url: string | null; recorded_at: number }

export function makeSqliteAssessmentRepository(databasePath: string): AssessmentRepository {
  return {
    loadTarget: (runId, taskId, input) =>
      databaseEffect(databasePath, "load", (db) => loadTarget(db, runId, taskId, input)),
    commit: (target, output, runtimeVersion) =>
      databaseEffect(databasePath, "commit", (db) => commit(db, target, output, runtimeVersion)),
  }
}

function databaseEffect<A>(
  path: string,
  operation: AssessmentPersistenceError["operation"],
  use: (db: Database.Database) => A,
) {
  return Effect.try({
    try: () => {
      const db = new Database(path, { fileMustExist: true })
      db.pragma("foreign_keys = ON")
      db.pragma("busy_timeout = 5000")
      try {
        return use(db)
      } finally {
        db.close()
      }
    },
    catch: () => new AssessmentPersistenceError({ operation }),
  })
}

function loadTarget(
  db: Database.Database,
  runId: string,
  taskId: string,
  input: Readonly<Record<string, unknown>>,
): AssessmentTarget {
  const inspectionId = required(input, "inspectionId")
  const row = db
    .prepare(`select wi.id, wi.run_business_id, wi.canonical_business_id, wi.status, wi.configuration_version, cb.name, cb.locality, pr.search_brief,
    exists(select 1 from contact_routes cr where cr.run_business_id = wi.run_business_id) as has_contact
    from website_inspections wi join canonical_businesses cb on cb.id = wi.canonical_business_id join prospecting_runs pr on pr.id = wi.run_id
    where wi.id = ? and wi.run_id = ?`)
    .get(inspectionId, runId) as TargetRow | undefined
  if (!row) throw new Error("assessment target missing")
  const suppressed = db
    .prepare(
      `select 1 from suppression_entries se
       join canonical_businesses cb on cb.identity_fingerprint = se.identity_fingerprint
       where cb.id = ?`,
    )
    .get(row.canonical_business_id)
  if (suppressed) throw new Error("business is globally suppressed")
  const brief = JSON.parse(row.search_brief) as {
    category: string
    runtime: AssessmentTarget["runtimeId"]
    runtimeConfiguration?: AssessmentTarget["runtimeConfiguration"]
  }
  const pages = db
    .prepare("select * from inspection_pages where inspection_id = ? order by sequence, viewport")
    .all(inspectionId) as PageRow[]
  const presences = db
    .prepare(
      "select type, url, collected_at from online_presences where run_business_id = ? and association_state = 'Confirmed' order by collected_at, id",
    )
    .all(row.run_business_id) as PresenceRow[]
  const blocks = db
    .prepare(
      "select code, url, recorded_at from inspection_blocks where inspection_id = ? order by recorded_at, id",
    )
    .all(inspectionId) as BlockRow[]
  return {
    runId,
    taskId,
    runBusinessId: row.run_business_id,
    canonicalBusinessId: row.canonical_business_id,
    inspectionId,
    runtimeId: brief.runtime,
    ...(brief.runtimeConfiguration ? { runtimeConfiguration: brief.runtimeConfiguration } : {}),
    inspectionConfigurationVersion: row.configuration_version,
    evidence: {
      envelopeVersion: "assessment-evidence-v1",
      business: {
        name: row.name,
        category: brief.category,
        locality: row.locality,
        hasPublicContactRoute: Boolean(row.has_contact),
        websiteState:
          row.status === "NoWebsite"
            ? "NoWebsite"
            : row.status === "Blocked"
              ? "Blocked"
              : "Present",
      },
      pages: pages.map((page) => ({
        sourceUrl: page.final_url,
        observedAt: new Date(page.captured_at).toISOString(),
        viewport: page.viewport,
        title: page.title,
        ...(page.description ? { description: page.description } : {}),
        renderedText: page.rendered_text,
        links: JSON.parse(page.links),
        forms: JSON.parse(page.forms),
        consoleFailures: JSON.parse(page.console_failures),
        networkFailures: JSON.parse(page.network_failures),
        measurements: JSON.parse(page.measurements),
      })),
      publicPresenceSources: presences.map((presence) => ({
        type: presence.type,
        sourceUrl: presence.url,
        observedAt: new Date(presence.collected_at).toISOString(),
      })),
      inspectionBlocks: blocks.map((block) => ({
        code: block.code,
        ...(block.url ? { sourceUrl: block.url } : {}),
        observedAt: new Date(block.recorded_at).toISOString(),
      })),
    },
  }
}

function commit(
  db: Database.Database,
  target: AssessmentTarget,
  output: AssessmentOutput,
  runtimeVersion?: string,
): string {
  return db.transaction(() => {
    const existing = db
      .prepare("select id from website_assessments where task_id = ?")
      .get(target.taskId) as { id: string } | undefined
    if (existing) return existing.id
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(
      `insert into website_assessments (id,run_id,task_id,run_business_id,canonical_business_id,inspection_id,runtime_id,runtime_version,prompt_version,output_schema_version,inspection_configuration_version,assessment_state,summary,apparent_commercial_value,assessed_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      target.runId,
      target.taskId,
      target.runBusinessId,
      target.canonicalBusinessId,
      target.inspectionId,
      target.runtimeId,
      runtimeVersion ?? null,
      ASSESSMENT_PROMPT_VERSION,
      ASSESSMENT_SCHEMA_VERSION,
      target.inspectionConfigurationVersion,
      output.assessmentState,
      output.summary,
      output.apparentCommercialValue,
      now,
    )
    const insertOpportunity = db.prepare(
      "insert into website_opportunities (id,assessment_id,opportunity_class,severity,confidence,observable_effect,explanation,sequence) values (?,?,?,?,?,?,?,?)",
    )
    const insertObservation = db.prepare(
      "insert into supporting_observations (id,opportunity_id,statement,source_url,observed_at,evidence_state,confidence,sequence) values (?,?,?,?,?,?,?,?)",
    )
    output.opportunities.forEach((opportunity, sequence) => {
      const opportunityId = crypto.randomUUID()
      insertOpportunity.run(
        opportunityId,
        id,
        opportunity.class,
        opportunity.severity,
        opportunity.confidence,
        opportunity.observableEffect,
        opportunity.explanation,
        sequence,
      )
      opportunity.observations.forEach((observation, observationSequence) => {
        insertObservation.run(
          crypto.randomUUID(),
          opportunityId,
          observation.statement,
          observation.sourceUrl,
          new Date(observation.observedAt).getTime(),
          observation.evidenceState,
          observation.confidence,
          observationSequence,
        )
      })
    })
    db.prepare(
      "update canonical_businesses set last_assessed_at = ?, updated_at = ? where id = ?",
    ).run(now, now, target.canonicalBusinessId)
    db.prepare("update run_businesses set status = 'Assessed', updated_at = ? where id = ?").run(
      now,
      target.runBusinessId,
    )
    db.prepare(
      "update run_metrics set assessments = assessments + 1, updated_at = ?, version = version + 1 where run_id = ?",
    ).run(now, target.runId)
    return id
  })()
}

function required(input: Readonly<Record<string, unknown>>, key: string): string {
  const value = input[key]
  if (typeof value !== "string" || !value) throw new Error(`missing ${key}`)
  return value
}
