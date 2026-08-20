import Database from "better-sqlite3"

export function suppressCandidate(databasePath: string, scoreId: string, reason: string): void {
  if (!reason.trim()) throw new Error("Suppression reason is required.")
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
        reason.trim().slice(0, 500),
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
