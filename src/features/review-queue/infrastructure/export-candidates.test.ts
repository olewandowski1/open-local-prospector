import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import {
  type CandidateExport,
  exportCandidates,
  toCsv,
} from "@/features/review-queue/infrastructure/export-candidates"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("export contract", () => {
  it("keeps export data explicit and contains no outreach action", () => {
    const keys = Object.keys({
      business: "A, B",
      locality: "Łódź",
      score: 70,
      rubricVersion: "v1",
      assessmentTimestamp: "now",
      reviewStatus: "Shortlisted",
      scoreBreakdown: {},
      evidenceLinks: [],
      contactRoutes: [],
    } satisfies CandidateExport)
    expect(keys).not.toContain("outreach")
  })

  it.each(["=formula", "+formula", "-formula", "@formula", "  =formula"])(
    "neutralizes spreadsheet formula input beginning with %s",
    (business) => {
      const body = toCsv([
        {
          business,
          locality: "Fixture Town",
          score: 70,
          rubricVersion: "v1",
          assessmentTimestamp: "2026-08-27T00:00:00.000Z",
          reviewStatus: "Shortlisted",
          scoreBreakdown: {},
          evidenceLinks: [],
          contactRoutes: [],
        },
      ])

      expect(body.split("\r\n")[1]).toContain(`"'${business.replaceAll('"', '""')}"`)
    },
  )

  it("exports persisted candidates with evidence and without outreach fields", () => {
    const directory = mkdtempSync(join(tmpdir(), "prospector-export-"))
    directories.push(directory)
    const databasePath = join(directory, "workspace.sqlite")
    seedE2eWorkspace(databasePath)

    const result = exportCandidates(databasePath, { format: "json" })
    const candidates = JSON.parse(result.body) as CandidateExport[]

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0]?.evidenceLinks.length).toBeGreaterThan(0)
    expect(candidates.every((candidate) => !("outreach" in candidate))).toBe(true)
    expect(result.contentType).toBe("application/json; charset=utf-8")
  })

  it("applies status and selection filters before loading related records", () => {
    const directory = mkdtempSync(join(tmpdir(), "prospector-export-"))
    directories.push(directory)
    const databasePath = join(directory, "workspace.sqlite")
    seedE2eWorkspace(databasePath)
    const all = JSON.parse(
      exportCandidates(databasePath, { format: "json" }).body,
    ) as CandidateExport[]
    const selected = all[0]
    expect(selected).toBeDefined()

    const filtered = JSON.parse(
      exportCandidates(databasePath, {
        format: "json",
        statuses: [selected?.reviewStatus ?? "Unreviewed"],
        selectedIds: [readTopScoreId(databasePath)],
      }).body,
    ) as CandidateExport[]

    expect(filtered).toEqual([selected])
    expect(
      JSON.parse(exportCandidates(databasePath, { format: "json", statuses: [] }).body),
    ).toEqual([])
  })
})

function readTopScoreId(databasePath: string): string {
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return database
      .prepare("select id from candidate_scores where qualified=1 order by total desc,id limit 1")
      .pluck()
      .get() as string
  } finally {
    database.close()
  }
}
