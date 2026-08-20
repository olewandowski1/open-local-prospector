import { describe, expect, it } from "vitest"

import {
  formatBytes,
  formatCount,
  formatWorkspaceDate,
  presentWorkspaceInventory,
} from "@/features/workspace-administration/domain/workspace-presentation"

describe("workspace presentation", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1_536, "1.5 KB"],
    [12_288, "12 KB"],
    [1_572_864, "1.5 MB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it("formats every reader-facing count", () => {
    expect(
      presentWorkspaceInventory({
        databasePath: "state.sqlite",
        databaseBytes: 1_572_864,
        artifactsPath: "artifacts",
        artifactCount: 1_200,
        artifactBytes: 12_288,
        runs: 1_001,
        discoveredBusinesses: 2_002,
        qualifiedCandidates: 300,
        decisionsRecorded: 40,
        technicalEvents: 5_000,
        suppressions: 6,
      }),
    ).toEqual({
      databasePath: "state.sqlite",
      databaseSize: "1.5 MB",
      artifactsPath: "artifacts",
      artifactCount: "1,200",
      artifactSize: "12 KB",
      runs: "1,001",
      discoveredBusinesses: "2,002",
      qualifiedCandidates: "300",
      decisionsRecorded: "40",
      technicalEvents: "5,000",
      suppressions: "6",
    })
  })

  it("formats standalone counts and dates without exposing raw values", () => {
    expect(formatCount(12_345)).toBe("12,345")
    expect(formatWorkspaceDate("2026-08-20T12:00:00.000Z")).toBe("20 Aug 2026")
    expect(formatWorkspaceDate("invalid")).toBe("Unknown")
  })
})
