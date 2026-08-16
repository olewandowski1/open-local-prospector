import Database from "better-sqlite3"
import { Effect } from "effect"
import {
  calculateOpportunityScore,
  REVIEW_QUEUE_THRESHOLD,
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
          completionState: "Search Exhausted" as const,
        }
      const row = db
        .prepare(
          `select wa.run_business_id,wa.canonical_business_id,wa.apparent_commercial_value,cb.decision_scope,coalesce(max(wo.severity),0) severity,coalesce(avg(so.confidence),0) confidence,count(distinct wo.id) opportunities,count(distinct so.id) observations,exists(select 1 from contact_routes cr where cr.run_business_id=wa.run_business_id) has_contact from website_assessments wa join canonical_businesses cb on cb.id=wa.canonical_business_id left join website_opportunities wo on wo.assessment_id=wa.id left join supporting_observations so on so.opportunity_id=wo.id where wa.id=? group by wa.id`,
        )
        .get(assessmentId) as
        | {
            run_business_id: string
            canonical_business_id: string
            apparent_commercial_value: number
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
        observationConfidence: row.confidence,
        hasContactRoute: Boolean(row.has_contact),
        localDecisionLikelihood: row.decision_scope === "Local" ? 1 : 0,
        apparentCommercialValue: row.apparent_commercial_value,
      })
      const qualified =
        breakdown.total >= REVIEW_QUEUE_THRESHOLD &&
        row.opportunities > 0 &&
        row.observations > 0 &&
        Boolean(row.has_contact)
      const id = crypto.randomUUID()
      const now = Date.now()
      db.prepare(
        `insert into candidate_scores (id,run_id,task_id,run_business_id,canonical_business_id,assessment_id,rubric_version,severity_component,confidence_component,contact_component,local_decision_component,commercial_value_component,total,qualified,scored_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        task.runId,
        task.id,
        row.run_business_id,
        row.canonical_business_id,
        assessmentId,
        breakdown.rubricVersion,
        breakdown.severity,
        breakdown.observationConfidence,
        breakdown.contactRoute,
        breakdown.localDecisionLikelihood,
        breakdown.apparentCommercialValue,
        breakdown.total,
        qualified ? 1 : 0,
        now,
      )
      db.prepare("update run_businesses set status=?,updated_at=? where id=?").run(
        qualified ? "Candidate" : "BelowThreshold",
        now,
        row.run_business_id,
      )
      db.prepare(
        "update run_metrics set qualified_candidates=(select count(*) from candidate_scores where run_id=? and qualified=1),updated_at=?,version=version+1 where run_id=?",
      ).run(task.runId, now, task.runId)
      return {
        value: {
          scoreId: id,
          score: breakdown.total,
          qualified,
          rubricVersion: breakdown.rubricVersion,
          schemaVersion: 1,
        },
        completionState: "Search Exhausted" as const,
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
