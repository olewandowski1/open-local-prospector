import Database from "better-sqlite3"
import { Effect } from "effect"
import {
  calculateOpportunityScore,
  type PageDefectMeasurements,
  qualifiesOpportunityScore,
} from "@/features/review-queue/domain/opportunity-score"
import type { RunTask, TaskCheckpoint } from "@/features/run-execution"
import { TaskExecutionError } from "@/features/run-execution"

export function makeScoreCandidateTaskExecutor(databasePath: string) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.try({
      try: () => score(databasePath, task),
      catch: () =>
        new TaskExecutionError({
          classification: "Infrastructure",
          code: "score-persistence",
          message: "Candidate scoring could not be completed.",
        }),
    })
}

function score(databasePath: string, task: RunTask): TaskCheckpoint {
  const assessmentId = required(task.input, "assessmentId")
  const db = new Database(databasePath, { fileMustExist: true })
  db.pragma("foreign_keys = ON")
  try {
    return db.transaction(() => {
      const existing = db
        .prepare("select id,total,qualified,rubric_version from candidate_scores where task_id = ?")
        .get(task.id) as
        | { id: string; total: number; qualified: number; rubric_version: string }
        | undefined
      if (existing)
        return {
          value: {
            scoreId: existing.id,
            score: existing.total,
            qualified: Boolean(existing.qualified),
            rubricVersion: existing.rubric_version,
            schemaVersion: 1,
          },
        }
      const row = db
        .prepare(
          `select wa.run_business_id,wa.canonical_business_id,wa.apparent_commercial_value,wa.inspection_id,wi.status inspection_state,cb.decision_scope,coalesce(max(wo.severity),0) severity,coalesce(avg(so.confidence),0) confidence,count(distinct wo.id) opportunities,count(distinct so.id) observations,exists(select 1 from contact_routes cr where cr.run_business_id=wa.run_business_id) has_contact from website_assessments wa join website_inspections wi on wi.id=wa.inspection_id join canonical_businesses cb on cb.id=wa.canonical_business_id left join website_opportunities wo on wo.assessment_id=wa.id left join supporting_observations so on so.opportunity_id=wo.id where wa.id=? group by wa.id`,
        )
        .get(assessmentId) as
        | {
            run_business_id: string
            canonical_business_id: string
            apparent_commercial_value: number
            inspection_id: string
            inspection_state: "Complete" | "Partial" | "Blocked" | "NoWebsite"
            decision_scope: string
            severity: number
            confidence: number
            opportunities: number
            observations: number
            has_contact: number
          }
        | undefined
      if (!row) throw new Error("assessment missing")
      const breakdown = calculateOpportunityScore({
        severity: row.severity,
        observedPages: readObservedPages(db, row.inspection_id),
        hasContactRoute: Boolean(row.has_contact),
        localDecisionLikelihood: row.decision_scope === "Local" ? 1 : 0,
        apparentCommercialValue: row.apparent_commercial_value,
        inspectionState: row.inspection_state,
        corroboratingSources: countCorroboratingSources(db, row.canonical_business_id),
      })
      const suppressed = db
        .prepare(
          `select 1 from suppression_entries se
           join canonical_businesses cb on cb.identity_fingerprint=se.identity_fingerprint
           where cb.id=?`,
        )
        .get(row.canonical_business_id)
      const qualified = qualifiesOpportunityScore(breakdown, {
        hasOpportunity: row.opportunities > 0,
        hasObservation: row.observations > 0,
        hasContactRoute: Boolean(row.has_contact),
        suppressed: Boolean(suppressed),
      })
      const id = crypto.randomUUID()
      const now = Date.now()
      db.prepare(
        `insert into candidate_scores (id,run_id,task_id,run_business_id,canonical_business_id,assessment_id,rubric_version,severity_component,observed_defect_component,contact_component,local_decision_component,commercial_value_component,total,qualified,scored_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        task.runId,
        task.id,
        row.run_business_id,
        row.canonical_business_id,
        assessmentId,
        breakdown.rubricVersion,
        breakdown.severity,
        breakdown.observedDefects,
        breakdown.contactRoute,
        breakdown.localDecisionLikelihood,
        breakdown.apparentCommercialValue,
        breakdown.total,
        qualified ? 1 : 0,
        now,
      )
      carryReviewNotes(db, row.canonical_business_id, id, now)
      db.prepare("update run_businesses set status=?,updated_at=? where id=?").run(
        qualified ? "Candidate" : "BelowThreshold",
        now,
        row.run_business_id,
      )
      db.prepare(
        `update run_metrics set
         qualified_candidates=(select count(*) from candidate_scores where run_id=? and qualified=1),
         target_remaining=max(0,
           (select json_extract(search_brief,'$.targetCount') from prospecting_runs where id=?) -
           (select count(*) from candidate_scores where run_id=? and qualified=1)),
         updated_at=?,version=version+1 where run_id=?`,
      ).run(task.runId, task.runId, task.runId, now, task.runId)
      return {
        value: {
          scoreId: id,
          score: breakdown.total,
          qualified,
          rubricVersion: breakdown.rubricVersion,
          schemaVersion: 1,
        },
      }
    })()
  } finally {
    db.close()
  }
}
function required(input: Readonly<Record<string, unknown>>, key: string) {
  const value = input[key]
  if (typeof value !== "string" || !value) throw new Error(`missing ${key}`)
  return value
}

// A newer score asks the reader to decide again, so only the written notes travel with it.
function carryReviewNotes(
  db: Database.Database,
  canonicalBusinessId: string,
  scoreId: string,
  now: number,
): void {
  const previous = db
    .prepare(
      `select cr.private_notes,cr.follow_up_at from candidate_reviews cr join candidate_scores cs on cs.id=cr.score_id where cs.canonical_business_id=? and cs.id<>? order by cs.scored_at desc,cs.id desc limit 1`,
    )
    .get(canonicalBusinessId, scoreId) as
    | { private_notes: string; follow_up_at: number | null }
    | undefined
  if (!previous) return
  if (previous.private_notes.length === 0 && previous.follow_up_at === null) return
  db.prepare(
    `insert into candidate_reviews (id,score_id,status,private_notes,follow_up_at,updated_at) values (?,?,'Unreviewed',?,?,?)`,
  ).run(crypto.randomUUID(), scoreId, previous.private_notes, previous.follow_up_at, now)
}

// Distinct public pages read about the business, which is what corroborates an absent website.
function countCorroboratingSources(db: Database.Database, canonicalBusinessId: string): number {
  return Number(
    db
      .prepare("select count(distinct url) from online_presences where canonical_business_id = ?")
      .pluck()
      .get(canonicalBusinessId),
  )
}

// The rubric reads the recorded measurements directly, so they are loaded rather than summarised.
function readObservedPages(
  db: Database.Database,
  inspectionId: string,
): readonly PageDefectMeasurements[] {
  const rows = db
    .prepare(
      "select json_extract(measurements,'$.unlabeledControls') unlabeled_controls,json_extract(measurements,'$.imagesMissingAlt') images_missing_alt,json_extract(measurements,'$.horizontalOverflow') horizontal_overflow,json_extract(measurements,'$.usesHttps') uses_https,json_extract(measurements,'$.firstContentfulPaintMs') first_contentful_paint_ms from inspection_pages where inspection_id=?",
    )
    .all(inspectionId) as {
    unlabeled_controls: number | null
    images_missing_alt: number | null
    horizontal_overflow: number | null
    uses_https: number | null
    first_contentful_paint_ms: number | null
  }[]
  return rows.map((page) => ({
    unlabeledControls: page.unlabeled_controls ?? 0,
    imagesMissingAlt: page.images_missing_alt ?? 0,
    horizontalOverflow: Boolean(page.horizontal_overflow),
    usesHttps: page.uses_https !== 0,
    firstContentfulPaintMs: page.first_contentful_paint_ms ?? 0,
  }))
}
