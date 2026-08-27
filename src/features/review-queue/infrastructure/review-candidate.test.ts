import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import {
  addCandidateCorrection,
  updateCandidateReview,
} from "@/features/review-queue/infrastructure/review-candidate"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("candidate review validation", () => {
  it("requires a reason for rejection", () => {
    expect(() => updateCandidateReview("missing.sqlite", "score", { status: "Rejected" })).toThrow(
      "rejection reason",
    )
  })
  it("requires an explanation for Other", () => {
    expect(() =>
      updateCandidateReview("missing.sqlite", "score", {
        status: "Rejected",
        rejectionReason: "Other",
      }),
    ).toThrow("Other requires")
  })

  it("rejects a reason outside the recorded domain", () => {
    expect(() =>
      updateCandidateReview("missing.sqlite", "score", {
        status: "Rejected",
        rejectionReason: "Invented" as never,
      }),
    ).toThrow("invalid rejection reason")
  })

  it("rejects review and correction text beyond their persisted bounds", () => {
    expect(() =>
      updateCandidateReview("missing.sqlite", "score", {
        status: "Shortlisted",
        privateNotes: "x".repeat(10_001),
      }),
    ).toThrow("private notes are too long")
    expect(() =>
      addCandidateCorrection("missing.sqlite", "score", {
        target: "SupportingObservation",
        correctedValue: "x".repeat(4_001),
      }),
    ).toThrow("corrected value is too long")
  })

  it("persists a decision, notes, follow-up, and append-only correction together", () => {
    const directory = mkdtempSync(join(tmpdir(), "prospector-review-"))
    directories.push(directory)
    const databasePath = join(directory, "workspace.sqlite")
    seedE2eWorkspace(databasePath)
    const database = new Database(databasePath)
    try {
      const scoreId = database
        .prepare("select id from candidate_scores where qualified=1 order by total desc limit 1")
        .pluck()
        .get() as string

      updateCandidateReview(databasePath, scoreId, {
        status: "Rejected",
        rejectionReason: "EvidenceTooWeak",
        rejectionNote: "The source does not support the recommendation.",
        privateNotes: "Recheck after the next season.",
        followUpAt: "2026-10-01",
      })
      addCandidateCorrection(databasePath, scoreId, {
        target: "SupportingObservation",
        correctedValue: "The booking link is available from the contact page.",
        note: "Verified manually.",
      })

      expect(
        database
          .prepare(
            "select status,rejection_reason,rejection_note,private_notes from candidate_reviews where score_id=?",
          )
          .get(scoreId),
      ).toEqual({
        status: "Rejected",
        rejection_reason: "EvidenceTooWeak",
        rejection_note: "The source does not support the recommendation.",
        private_notes: "Recheck after the next season.",
      })
      expect(
        database
          .prepare("select target,corrected_value,note from candidate_corrections where score_id=?")
          .get(scoreId),
      ).toEqual({
        target: "SupportingObservation",
        corrected_value: "The booking link is available from the contact page.",
        note: "Verified manually.",
      })
    } finally {
      database.close()
    }
  })
})
