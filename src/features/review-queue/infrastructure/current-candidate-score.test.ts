import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import { exportCandidates } from "@/features/review-queue/infrastructure/export-candidates"
import { makeScoreCandidateTaskExecutor } from "@/features/review-queue/infrastructure/score-candidate"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function seededWorkspace() {
  const directory = mkdtempSync(join(tmpdir(), "prospector-current-score-"))
  directories.push(directory)
  const databasePath = join(directory, "workspace.sqlite")
  seedE2eWorkspace(databasePath, join(directory, "artifacts"))
  return databasePath
}

// Re-scoring a business is the supported way to refresh it, so the reader must see the newer score once.
function reScore(databasePath: string, taskId: string) {
  const database = new Database(databasePath)
  const target = database
    .prepare(
      `select cs.id score_id, cs.assessment_id, cs.canonical_business_id, cs.run_id, cb.name
       from candidate_scores cs join canonical_businesses cb on cb.id = cs.canonical_business_id
       where cs.qualified = 1 order by cs.total desc limit 1`,
    )
    .get() as {
    score_id: string
    assessment_id: string
    canonical_business_id: string
    run_id: string
    name: string
  }
  database
    .prepare(
      `insert into candidate_reviews (id, score_id, status, private_notes, follow_up_at, updated_at)
       values (?, ?, 'Shortlisted', ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      target.score_id,
      "Owner prefers a call after 5pm.",
      1_800_000_000_000,
      Date.now(),
    )
  database
    .prepare(
      `insert into run_tasks (id, run_id, stage, status, attempt_count, max_attempts, available_at,
        input, schema_version, version, created_at, updated_at)
       values (?, ?, 'ScoreCandidate', 'Pending', 0, 3, 0, '{}', 1, 1, ?, ?)`,
    )
    .run(taskId, target.run_id, Date.now(), Date.now())
  database.close()
  return target
}

describe("current candidate score", () => {
  it("shows the newest score once and carries the written notes onto it", async () => {
    const databasePath = seededWorkspace()
    const taskId = crypto.randomUUID()
    const target = reScore(databasePath, taskId)

    await Effect.runPromise(
      makeScoreCandidateTaskExecutor(databasePath)({
        id: taskId,
        runId: target.run_id,
        stage: "ScoreCandidate",
        status: "Leased",
        attemptCount: 1,
        maxAttempts: 3,
        input: { assessmentId: target.assessment_id },
        schemaVersion: 1,
        version: 1,
      }),
    )

    const database = new Database(databasePath, { readonly: true })
    const scores = database
      .prepare("select id from candidate_scores where canonical_business_id = ?")
      .all(target.canonical_business_id)
    const carried = database
      .prepare(
        `select cr.status, cr.private_notes, cr.follow_up_at from candidate_reviews cr
         join candidate_scores cs on cs.id = cr.score_id
         where cs.canonical_business_id = ? and cs.id <> ?`,
      )
      .get(target.canonical_business_id, target.score_id) as {
      status: string
      private_notes: string
      follow_up_at: number
    }
    database.close()

    // The earlier score is retained rather than rewritten.
    expect(scores).toHaveLength(2)
    expect(carried).toMatchObject({
      status: "Unreviewed",
      private_notes: "Owner prefers a call after 5pm.",
      follow_up_at: 1_800_000_000_000,
    })

    const exported = exportCandidates(databasePath, { format: "json" })
    const rows = JSON.parse(exported.body) as { business: string }[]
    expect(rows.filter((row) => row.business === target.name)).toHaveLength(1)
  })
})
