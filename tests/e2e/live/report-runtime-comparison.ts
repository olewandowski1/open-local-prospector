import { resolve } from "node:path"
import Database from "better-sqlite3"

const database = new Database(resolve(".scratch/live-e2e/workspace.sqlite"), { readonly: true })

try {
  const runs = database
    .prepare(
      `select r.id, r.state, r.completion_state as completionState, r.current_stage as currentStage,
        r.failure, r.search_brief as searchBrief, r.created_at as createdAt, r.updated_at as updatedAt,
        m.queries, m.discoveries, m.duplicates, m.exclusions, m.websites, m.assessments,
        m.qualified_candidates as qualifiedCandidates, m.blocked_inspections as blockedInspections
      from prospecting_runs r left join run_metrics m on m.run_id = r.id order by r.created_at`,
    )
    .all() as Array<Record<string, unknown> & { id: string; searchBrief: string }>

  const businessNames = database.prepare(
    `select db.name from run_businesses rb
      join discovered_businesses db on db.id = rb.discovered_business_id
      where rb.run_id = ? and rb.status = 'Eligible' order by db.name`,
  )
  const candidates = database.prepare(
    `select cb.name, round(cs.total, 1) as score, cs.qualified
      from candidate_scores cs join canonical_businesses cb on cb.id = cs.canonical_business_id
      where cs.run_id = ? order by cb.name`,
  )
  const exclusions = database.prepare(
    `select db.name, rb.exclusion_code as code, rb.exclusion_reason as reason
      from run_businesses rb join discovered_businesses db on db.id = rb.discovered_business_id
      where rb.run_id = ? and rb.exclusion_code is not null order by db.name`,
  )

  console.log(
    JSON.stringify(
      runs.map((run) => ({
        ...run,
        runtime: JSON.parse(run.searchBrief).runtime,
        durationMinutes:
          Math.round(((Number(run.updatedAt) - Number(run.createdAt)) / 60_000) * 10) / 10,
        eligibleBusinesses: businessNames.pluck().all(run.id),
        exclusions: exclusions.all(run.id),
        candidates: candidates.all(run.id),
      })),
      null,
      2,
    ),
  )
} finally {
  database.close()
}
