import Database from "better-sqlite3"

export const REVIEW_STATUSES = [
  "Unreviewed",
  "Shortlisted",
  "Rejected",
  "Contacted",
  "Archived",
] as const
export const REJECTION_REASONS = [
  "NotALocalDecision",
  "NotABusinessFit",
  "EvidenceTooWeak",
  "AlreadyHasStrongWebsite",
  "Duplicate",
  "Other",
] as const
export const CORRECTION_TARGETS = [
  "IdentityLink",
  "OnlinePresence",
  "ContactRoute",
  "OpportunityClass",
  "SupportingObservation",
] as const

export type ReviewUpdate = Readonly<{
  status: (typeof REVIEW_STATUSES)[number]
  rejectionReason?: (typeof REJECTION_REASONS)[number]
  rejectionNote?: string
  privateNotes?: string
  followUpAt?: string | null
}>

export function updateCandidateReview(
  databasePath: string,
  scoreId: string,
  update: ReviewUpdate,
): void {
  if (!REVIEW_STATUSES.includes(update.status)) throw new Error("invalid review status")
  if (update.status === "Rejected" && !update.rejectionReason)
    throw new Error("rejection reason is required")
  if (
    update.status === "Rejected" &&
    update.rejectionReason === "Other" &&
    !update.rejectionNote?.trim()
  )
    throw new Error("Other requires a note")
  const followUpAt = update.followUpAt ? new Date(update.followUpAt).getTime() : null
  if (followUpAt !== null && !Number.isFinite(followUpAt)) throw new Error("invalid follow-up date")
  withDatabase(databasePath, (db) =>
    db
      .prepare(
        `insert into candidate_reviews (id,score_id,status,rejection_reason,rejection_note,private_notes,follow_up_at,updated_at) values (?,?,?,?,?,?,?,?) on conflict(score_id) do update set status=excluded.status,rejection_reason=excluded.rejection_reason,rejection_note=excluded.rejection_note,private_notes=excluded.private_notes,follow_up_at=excluded.follow_up_at,updated_at=excluded.updated_at`,
      )
      .run(
        crypto.randomUUID(),
        scoreId,
        update.status,
        update.status === "Rejected" ? (update.rejectionReason ?? null) : null,
        update.status === "Rejected" ? (update.rejectionNote?.trim() ?? null) : null,
        update.privateNotes?.slice(0, 10_000) ?? "",
        followUpAt,
        Date.now(),
      ),
  )
}

export function addCandidateCorrection(
  databasePath: string,
  scoreId: string,
  input: Readonly<{
    target: (typeof CORRECTION_TARGETS)[number]
    correctedValue: string
    note?: string
  }>,
): void {
  if (!CORRECTION_TARGETS.includes(input.target) || !input.correctedValue.trim())
    throw new Error("invalid correction")
  withDatabase(databasePath, (db) =>
    db
      .prepare(
        "insert into candidate_corrections (id,score_id,target,corrected_value,note,created_at) values (?,?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        scoreId,
        input.target,
        input.correctedValue.trim().slice(0, 4_000),
        input.note?.trim().slice(0, 2_000) ?? "",
        Date.now(),
      ),
  )
}

function withDatabase(path: string, use: (database: Database.Database) => void): void {
  const db = new Database(path, { fileMustExist: true })
  db.pragma("foreign_keys = ON")
  try {
    use(db)
  } finally {
    db.close()
  }
}
