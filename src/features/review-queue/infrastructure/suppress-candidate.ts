import Database from "better-sqlite3"
import { REVIEW_QUEUE_THRESHOLD } from "@/features/review-queue/domain/opportunity-score"
import { MAX_SUPPRESSION_REASON_LENGTH } from "@/features/review-queue/domain/review-policy"

export function suppressCandidate(databasePath: string, scoreId: string, reason: string): void {
  if (!reason.trim()) throw new Error("Suppression reason is required.")
  if (reason.length > MAX_SUPPRESSION_REASON_LENGTH)
    throw new Error("Suppression reason is too long.")
  const db = new Database(databasePath, { fileMustExist: true })
  db.pragma("foreign_keys = ON")
  try {
    db.transaction(() => {
      const row = db
        .prepare(
          `select cs.canonical_business_id, cb.identity_fingerprint, cb.name
           from candidate_scores cs
           join canonical_businesses cb on cb.id = cs.canonical_business_id
           where cs.id = ?`,
        )
        .get(scoreId) as
        | { canonical_business_id: string; identity_fingerprint: string; name: string }
        | undefined
      if (!row) throw new Error("Candidate not found.")
      db.prepare(
        `insert into suppression_entries
         (identity_fingerprint,canonical_business_id,business_name,reason,created_at)
         values (?,?,?,?,?)
         on conflict(identity_fingerprint) do update set
           canonical_business_id=excluded.canonical_business_id,
           business_name=excluded.business_name,
           reason=excluded.reason,
           created_at=excluded.created_at`,
      ).run(
        row.identity_fingerprint,
        row.canonical_business_id,
        row.name,
        reason.trim(),
        Date.now(),
      )
      db.prepare("update candidate_scores set qualified=0 where canonical_business_id=?").run(
        row.canonical_business_id,
      )
    })()
  } finally {
    db.close()
  }
}

export function liftCandidateSuppression(
  databasePath: string,
  identityFingerprint: string,
): boolean {
  const db = new Database(databasePath, { fileMustExist: true })
  db.pragma("foreign_keys = ON")
  try {
    return db.transaction(() => {
      const suppression = db
        .prepare(
          "select canonical_business_id from suppression_entries where identity_fingerprint = ?",
        )
        .get(identityFingerprint) as { canonical_business_id: string | null } | undefined
      if (!suppression) return false
      db.prepare("delete from suppression_entries where identity_fingerprint = ?").run(
        identityFingerprint,
      )
      const canonicalBusinessId = suppression.canonical_business_id
      if (!canonicalBusinessId) return true

      // Rebuild eligibility for rows written before suppression stopped clearing the score.
      db.prepare(
        `update candidate_scores set qualified = case when total >= ?
         and exists(select 1 from website_opportunities wo
           where wo.assessment_id = candidate_scores.assessment_id)
         and exists(select 1 from supporting_observations so
           join website_opportunities wo on wo.id = so.opportunity_id
           where wo.assessment_id = candidate_scores.assessment_id)
         and exists(select 1 from contact_routes cr
           where cr.run_business_id = candidate_scores.run_business_id)
         then 1 else 0 end
         where canonical_business_id = ?`,
      ).run(REVIEW_QUEUE_THRESHOLD, canonicalBusinessId)
      const now = Date.now()
      db.prepare(
        `update run_businesses set status = case
           when exists(select 1 from candidate_scores cs
             where cs.run_business_id = run_businesses.id and cs.qualified = 1)
           then 'Candidate' else 'BelowThreshold' end,
         updated_at = ? where id in
           (select run_business_id from candidate_scores where canonical_business_id = ?)`,
      ).run(now, canonicalBusinessId)
      return true
    })()
  } finally {
    db.close()
  }
}
