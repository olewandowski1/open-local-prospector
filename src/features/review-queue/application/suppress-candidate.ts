import Database from "better-sqlite3"

export function suppressCandidate(databasePath: string, scoreId: string, reason: string): void {
  if (!reason.trim()) throw new Error("Suppression reason is required.")
  const db = new Database(databasePath, { fileMustExist: true })
  db.pragma("foreign_keys = ON")
  try {
    db.transaction(() => {
      const row = db
        .prepare("select canonical_business_id from candidate_scores where id=?")
        .get(scoreId) as { canonical_business_id: string } | undefined
      if (!row) throw new Error("Candidate not found.")
      db.prepare(
        "insert into suppression_entries (canonical_business_id,reason,created_at) values (?,?,?) on conflict(canonical_business_id) do update set reason=excluded.reason",
      ).run(row.canonical_business_id, reason.trim().slice(0, 500), Date.now())
      db.prepare("update candidate_scores set qualified=0 where canonical_business_id=?").run(
        row.canonical_business_id,
      )
    })()
  } finally {
    db.close()
  }
}
