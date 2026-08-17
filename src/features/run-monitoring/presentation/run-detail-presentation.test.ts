import { describe, expect, it } from "vitest"
import type {
  RunDetail,
  RunProgressCounts,
  TechnicalRunEvent,
} from "@/features/run-monitoring/domain/run-progress"
import {
  eventKindCounts,
  filterTechnicalLog,
  isRunTerminal,
  runAdjustments,
  runControlAvailability,
  runFunnel,
  safeHttpUrl,
} from "@/features/run-monitoring/presentation/run-detail-presentation"

const progress: RunProgressCounts = {
  queries: 21,
  discoveries: 16,
  duplicates: 1,
  exclusions: 2,
  websites: 8,
  assessments: 8,
  qualifiedCandidates: 2,
  blockedInspections: 8,
  targetRemaining: 8,
}

const detail = (overrides: Partial<RunDetail> = {}): RunDetail =>
  ({
    id: "run-1",
    state: "Running",
    requestedControl: "None",
    progress,
    businesses: [],
    technicalLog: [],
    ...overrides,
  }) as RunDetail

const event = (overrides: Partial<TechnicalRunEvent>): TechnicalRunEvent => ({
  id: "event-1",
  kind: "DiscoveryResult",
  message: "A public result URL was returned.",
  createdAt: "2026-08-16T10:00:00.000Z",
  ...overrides,
})

describe("run detail presentation", () => {
  it("orders the funnel along the pipeline the run actually follows", () => {
    expect(runFunnel(progress).map((step) => [step.label, step.value])).toEqual([
      ["Queries", 21],
      ["Discoveries", 16],
      ["Websites", 8],
      ["Assessments", 8],
      ["Qualified", 2],
    ])
  })

  it("keeps the counts that explain narrowing out of the pipeline itself", () => {
    expect(runAdjustments(progress).map((item) => item.label)).toEqual([
      "Duplicates",
      "Exclusions",
      "Blocked Inspections",
      "Target Remaining",
    ])
  })

  it("allows pausing only while work can still be interrupted", () => {
    expect(runControlAvailability(detail({ state: "Running" }))).toMatchObject({
      canPause: true,
      canCancel: true,
    })
    expect(
      runControlAvailability(detail({ state: "Running", requestedControl: "Pause" })).canPause,
    ).toBe(false)
    expect(runControlAvailability(detail({ state: "Completed" }))).toMatchObject({
      canPause: false,
      canCancel: false,
    })
  })

  it("allows resuming a paused run or one whose runtime went away", () => {
    expect(runControlAvailability(detail({ state: "Paused" })).canResume).toBe(true)
    expect(
      runControlAvailability(detail({ state: "Completed", completionState: "Runtime Unavailable" }))
        .canResume,
    ).toBe(true)
    expect(runControlAvailability(detail({ state: "Running" })).canResume).toBe(false)
  })

  it("stops polling only once the run is terminal", () => {
    expect(isRunTerminal(detail({ state: "Completed" }))).toBe(true)
    expect(isRunTerminal(detail({ state: "Cancelled" }))).toBe(true)
    expect(isRunTerminal(detail({ state: "Paused" }))).toBe(false)
    expect(isRunTerminal(undefined)).toBe(false)
  })

  it("counts event kinds most frequent first", () => {
    const events = [
      event({ id: "a", kind: "IdentityQuery" }),
      event({ id: "b", kind: "DiscoveryResult" }),
      event({ id: "c", kind: "DiscoveryResult" }),
    ]

    expect(eventKindCounts(events)).toEqual([
      { kind: "DiscoveryResult", count: 2 },
      { kind: "IdentityQuery", count: 1 },
    ])
  })

  it("narrows the log by kind and by business together", () => {
    const events = [
      event({ id: "a", kind: "DiscoveryResult", businessId: "b1" }),
      event({ id: "b", kind: "DiscoveryResult", businessId: "b2" }),
      event({ id: "c", kind: "IdentityQuery", businessId: "b1" }),
    ]

    expect(filterTechnicalLog(events, {}).map((item) => item.id)).toEqual(["a", "b", "c"])
    expect(filterTechnicalLog(events, { businessId: "b1" }).map((item) => item.id)).toEqual([
      "a",
      "c",
    ])
    expect(
      filterTechnicalLog(events, { kind: "DiscoveryResult", businessId: "b1" }).map(
        (item) => item.id,
      ),
    ).toEqual(["a"])
  })

  it("links only http and https result URLs", () => {
    expect(safeHttpUrl("https://example.test/page")).toBe("https://example.test/page")
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined()
    expect(safeHttpUrl("file:///etc/passwd")).toBeUndefined()
    expect(safeHttpUrl("not a url")).toBeUndefined()
    expect(safeHttpUrl(undefined)).toBeUndefined()
  })
})
