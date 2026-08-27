import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import { MAX_SUPPRESSION_REASON_LENGTH } from "@/features/review-queue/domain/review-policy"
import {
  liftCandidateSuppression,
  suppressCandidate,
} from "@/features/review-queue/infrastructure/suppress-candidate"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("candidate suppression", () => {
  it("restores evidence-backed eligibility when suppression is lifted", () => {
    const directory = mkdtempSync(join(tmpdir(), "prospector-suppression-"))
    directories.push(directory)
    const databasePath = join(directory, "workspace.sqlite")
    seedE2eWorkspace(databasePath)
    const candidate = readCandidate(databasePath)

    suppressCandidate(databasePath, candidate.scoreId, "Not relevant")
    expect(readCandidateState(databasePath, candidate.scoreId)).toEqual({
      qualified: 0,
      status: "Candidate",
      suppressions: 1,
    })

    expect(liftCandidateSuppression(databasePath, candidate.identityFingerprint)).toBe(true)
    expect(readCandidateState(databasePath, candidate.scoreId)).toEqual({
      qualified: 1,
      status: "Candidate",
      suppressions: 0,
    })
    expect(liftCandidateSuppression(databasePath, candidate.identityFingerprint)).toBe(false)
  })

  it("rejects an over-limit reason without changing candidate state", () => {
    const directory = mkdtempSync(join(tmpdir(), "prospector-suppression-"))
    directories.push(directory)
    const databasePath = join(directory, "workspace.sqlite")
    seedE2eWorkspace(databasePath)
    const candidate = readCandidate(databasePath)

    expect(() =>
      suppressCandidate(
        databasePath,
        candidate.scoreId,
        "x".repeat(MAX_SUPPRESSION_REASON_LENGTH + 1),
      ),
    ).toThrow("Suppression reason is too long.")
    expect(readCandidateState(databasePath, candidate.scoreId)).toEqual({
      qualified: 1,
      status: "Candidate",
      suppressions: 0,
    })
  })
})

function readCandidate(databasePath: string): { scoreId: string; identityFingerprint: string } {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return database
      .prepare(
        `select cs.id scoreId, cb.identity_fingerprint identityFingerprint
         from candidate_scores cs join canonical_businesses cb on cb.id = cs.canonical_business_id
         where cs.qualified = 1 order by cs.total desc limit 1`,
      )
      .get() as { scoreId: string; identityFingerprint: string }
  } finally {
    database.close()
  }
}

function readCandidateState(databasePath: string, scoreId: string) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const state = database
      .prepare(
        `select cs.qualified, rb.status from candidate_scores cs
         join run_businesses rb on rb.id = cs.run_business_id where cs.id = ?`,
      )
      .get(scoreId) as { qualified: number; status: string }
    const suppressions = Number(
      database.prepare("select count(*) from suppression_entries").pluck().get(),
    )
    return { ...state, suppressions }
  } finally {
    database.close()
  }
}
