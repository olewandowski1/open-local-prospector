import { describe, expect, it } from "vitest"
import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"
import {
  formatUpdatedAt,
  humanizeStage,
  toRunRow,
} from "@/features/run-monitoring/presentation/run-presentation"

const NOW = new Date("2026-08-16T12:00:00.000Z")

const summary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  id: "run-1",
  state: "Running",
  currentStage: "DiscoverBusinesses",
  searchBrief: {
    location: "Zdzieszowice",
    category: "Florist",
    targetCount: 10,
    mode: "Quick",
    runtime: "claude",
    searchArea: {
      id: "area-1",
      displayName: "Zdzieszowice, Polska",
      latitude: 50.4,
      longitude: 18.1,
      countryCode: "PL",
    },
  } as RunSummary["searchBrief"],
  progress: {
    queries: 3,
    discoveries: 16,
    duplicates: 1,
    exclusions: 2,
    websites: 9,
    assessments: 8,
    qualifiedCandidates: 2,
    blockedInspections: 0,
    targetRemaining: 8,
  },
  createdAt: "2026-08-16T09:00:00.000Z",
  updatedAt: "2026-08-16T09:00:00.000Z",
  version: 1,
  ...overrides,
})

describe("run presentation", () => {
  it("derives completion from qualified candidates against the requested target", () => {
    expect(toRunRow(summary(), NOW)).toMatchObject({
      category: "Florist",
      location: "Zdzieszowice, Polska",
      status: "Running",
      settled: false,
      completion: 20,
      qualified: 2,
      targetCount: 10,
      updatedLabel: "3 hours ago",
    })
  })

  it("prefers the completion state and marks finished runs as settled", () => {
    const row = toRunRow(summary({ state: "Completed", completionState: "Target Reached" }), NOW)

    expect(row).toMatchObject({ status: "Target Reached", settled: true })
  })

  it("never reports more than full completion", () => {
    const run = summary()
    const row = toRunRow({ ...run, progress: { ...run.progress, qualifiedCandidates: 25 } }, NOW)

    expect(row.completion).toBe(100)
  })

  it("spaces persisted stage identifiers for reading", () => {
    expect(humanizeStage("DiscoverBusinesses")).toBe("Discover Businesses")
    expect(humanizeStage("ScoreCandidate")).toBe("Score Candidate")
    expect(humanizeStage(undefined)).toBe("Waiting")
  })

  it("formats recent activity relatively and older activity absolutely", () => {
    expect(formatUpdatedAt("2026-08-16T11:59:30.000Z", NOW)).toBe("Just now")
    expect(formatUpdatedAt("2026-08-16T11:30:00.000Z", NOW)).toBe("30 minutes ago")
    expect(formatUpdatedAt("2026-08-15T12:00:00.000Z", NOW)).toBe("yesterday")
    expect(formatUpdatedAt("2026-07-01T12:00:00.000Z", NOW)).toMatch(/2026/)
    expect(formatUpdatedAt("not-a-date", NOW)).toBe("Unknown")
  })
})
