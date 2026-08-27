import Database from "better-sqlite3"
import {
  CORRECTION_TARGETS,
  MAX_CORRECTED_VALUE_LENGTH,
  MAX_CORRECTION_NOTE_LENGTH,
  MAX_PRIVATE_NOTES_LENGTH,
  MAX_REJECTION_NOTE_LENGTH,
  REJECTION_REASONS,
  REVIEW_STATUSES,
} from "@/features/review-queue/domain/review-policy"

export { CORRECTION_TARGETS, REJECTION_REASONS, REVIEW_STATUSES }

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
    !REJECTION_REASONS.includes(update.rejectionReason as (typeof REJECTION_REASONS)[number])
  )
    throw new Error("invalid rejection reason")
  if (
    update.status === "Rejected" &&
    update.rejectionReason === "Other" &&
    !update.rejectionNote?.trim()
  )
    throw new Error("Other requires a note")
  if ((update.rejectionNote?.length ?? 0) > MAX_REJECTION_NOTE_LENGTH)
    throw new Error("rejection note is too long")
  if ((update.privateNotes?.length ?? 0) > MAX_PRIVATE_NOTES_LENGTH)
    throw new Error("private notes are too long")
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
        update.privateNotes ?? "",
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
  if (input.correctedValue.length > MAX_CORRECTED_VALUE_LENGTH)
    throw new Error("corrected value is too long")
  if ((input.note?.length ?? 0) > MAX_CORRECTION_NOTE_LENGTH)
    throw new Error("correction note is too long")
  withDatabase(databasePath, (db) =>
    db
      .prepare(
        "insert into candidate_corrections (id,score_id,target,corrected_value,note,created_at) values (?,?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        scoreId,
        input.target,
        input.correctedValue.trim(),
        input.note?.trim() ?? "",
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
