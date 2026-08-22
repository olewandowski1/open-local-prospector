import { describe, expect, it } from "vitest"
import type {
  RunDetail,
  RunProgressCounts,
  TechnicalRunEvent,
} from "@/features/run-monitoring/domain/run-progress"
import {
  businessStatusTone,
  eventKindCounts,
  eventSourceLabel,
  filterTechnicalLog,
  formatBusinessScore,
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
      ["Assessments", 8],
      ["Qualified", 2],
    ])
  })

  it("keeps the counts that explain narrowing out of the pipeline itself", () => {
    // Websites belongs here: most local businesses have none, which is the opportunity itself.
    expect(runAdjustments(progress).map((item) => item.label)).toEqual([
      "Websites Found",
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

  // A run of eleven businesses carries a hundred task transitions, so ordering by count alone put
  // every event that says what the run found behind the scheduler's bookkeeping.
  it("offers the kinds a reader came for before the scheduler's bookkeeping", () => {
    const events = [
      ...Array.from({ length: 34 }, (_, index) =>
        event({ id: `claim-${index}`, kind: "TaskClaimed" }),
      ),
      ...Array.from({ length: 11 }, (_, index) =>
        event({ id: `found-${index}`, kind: "DiscoveryResult" }),
      ),
      event({ id: "failure", kind: "Failure" }),
    ]

    expect(eventKindCounts(events).map((item) => item.kind)).toEqual([
      "Failure",
      "DiscoveryResult",
      "TaskClaimed",
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

describe("eventSourceLabel", () => {
  it("shortens an internal identifier that tells a reader nothing", () => {
    expect(eventSourceLabel("90560377-8038-4b69-93d4-2129024aa399")).toBe("#90560377")
  })

  it("leaves a meaningful source name exactly as recorded", () => {
    expect(eventSourceLabel("subscription-runtime-web-search")).toBe(
      "subscription-runtime-web-search",
    )
  })

  it("does not mistake a near-miss for an identifier", () => {
    expect(eventSourceLabel("90560377-8038-4b69-93d4")).toBe("90560377-8038-4b69-93d4")
  })
})

describe("businessStatusTone", () => {
  it("marks a settled failure as destructive", () => {
    expect(businessStatusTone("FailedPermanent")).toBe("destructive")
    expect(businessStatusTone("Failed")).toBe("destructive")
  })

  it("warns rather than condemns when work may still succeed on another attempt", () => {
    expect(businessStatusTone("Blocked")).toBe("warning")
    expect(businessStatusTone("Unreachable")).toBe("warning")
  })

  it("marks work that finished well as success", () => {
    expect(businessStatusTone("Qualified")).toBe("success")
    expect(businessStatusTone("Completed")).toBe("success")
  })

  it("keeps an outcome that simply did not make the cut neutral, not alarming", () => {
    expect(businessStatusTone("BelowThreshold")).toBe("muted")
    expect(businessStatusTone("Excluded")).toBe("muted")
  })

  it("keeps work still in flight neutral", () => {
    expect(businessStatusTone("InProgress")).toBe("muted")
    expect(businessStatusTone("Anything Unrecognised")).toBe("muted")
  })
})

describe("formatBusinessScore", () => {
  it("keeps a whole score whole", () => {
    expect(formatBusinessScore(25)).toBe("25")
  })

  it("never shows a reader a raw float", () => {
    expect(formatBusinessScore(87.47)).toBe("87.5")
    expect(formatBusinessScore(24.666666666666668)).toBe("24.7")
  })
})
