import { describe, expect, it } from "vitest"
import { REVIEW_STATUSES } from "@/features/review-queue/domain/review-policy"
import {
  displayUrl,
  emptyQueueFilter,
  filterQueueCandidates,
  formatObservedAt,
  formatScore,
  groupPresences,
  humanizeTerm,
  isQueueFiltered,
  measurementFacts,
  queueFilterOptions,
  reviewStatusVariant,
  scoreComponents,
} from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

const candidate = (overrides: Partial<QueueCandidate> = {}): QueueCandidate =>
  ({
    breakdown: {
      severity: 32,
      confidence: 24.666666666666668,
      contact: 15,
      localDecision: 10,
      commercialValue: 5.8,
    },
    presences: [],
    ...overrides,
  }) as QueueCandidate

describe("review presentation", () => {
  it("spaces persisted vocabulary for reading", () => {
    expect(humanizeTerm("NoDedicatedWebsite")).toBe("No Dedicated Website")
    expect(humanizeTerm("BrokenOrUnusable")).toBe("Broken Or Unusable")
    expect(humanizeTerm("AlreadyHasStrongWebsite")).toBe("Already Has Strong Website")
    // A single-letter word is still a word: this read as "Not ALocal Decision".
    expect(humanizeTerm("NotALocalDecision")).toBe("Not A Local Decision")
    expect(humanizeTerm("NotABusinessFit")).toBe("Not A Business Fit")
  })

  it("reads a machine code as words too", () => {
    // An inspection limitation is stored kebab-case; the panel used to print it verbatim.
    expect(humanizeTerm("navigation-failed")).toBe("Navigation Failed")
    expect(humanizeTerm("chromium-unavailable")).toBe("Chromium Unavailable")
    expect(humanizeTerm("robots_disallowed")).toBe("Robots Disallowed")
  })

  it("rounds stored floats to a precision that carries meaning", () => {
    expect(formatScore(24.666666666666668)).toBe("24.7")
    expect(formatScore(87.47)).toBe("87.5")
    expect(formatScore(15)).toBe("15.0")
  })

  it("pairs every score component with its rubric maximum", () => {
    expect(scoreComponents(candidate())).toEqual([
      { label: "Severity", value: 32, max: 40 },
      { label: "Confidence", value: 24.666666666666668, max: 25 },
      { label: "Contact Route", value: 15, max: 15 },
      { label: "Local Decision", value: 10, max: 10 },
      { label: "Commercial Value", value: 5.8, max: 10 },
    ])
    expect(scoreComponents(candidate()).reduce((total, item) => total + item.max, 0)).toBe(100)
  })

  it("shows the observation date without the storage timestamp", () => {
    expect(formatObservedAt("2026-08-16T14:11:13.528Z")).toBe("16 Aug 2026")
    expect(formatObservedAt("not-a-date")).toBe("Unknown Date")
  })

  it("shortens long URLs without losing which page they point at", () => {
    expect(displayUrl("https://www.orlyflorystyki.pl/profile-6670-kwiaciarnia")).toBe(
      "orlyflorystyki.pl/profile-6670-kwiaciarnia",
    )
    expect(displayUrl("https://example.test/")).toBe("example.test")
    expect(displayUrl("not a url")).toBe("not a url")
  })

  it("groups presences by type and drops repeated URLs", () => {
    const presences = [
      { type: "Website", url: "https://a.test" },
      { type: "Website", url: "https://a.test" },
      { type: "Website", url: "https://b.test" },
      { type: "Directory", url: "https://c.test" },
    ]

    expect(groupPresences(presences)).toEqual([
      { type: "Website", urls: ["https://a.test", "https://b.test"] },
      { type: "Directory", urls: ["https://c.test"] },
    ])
  })

  it("turns captured measurements into bounded reader-facing facts", () => {
    expect(
      measurementFacts({
        navigationDurationMs: 1234.56,
        firstContentfulPaintMs: 456.78,
        domNodes: 1234,
        headings: 4,
        links: 12,
        forms: 1,
        images: 8,
        imagesMissingAlt: 2,
        unlabeledControls: 1,
        horizontalOverflow: true,
        usesHttps: true,
      }),
    ).toEqual([
      { label: "Page Load", value: "1.23 s" },
      { label: "First Contentful Paint", value: "0.46 s" },
      { label: "DOM Nodes", value: "1,234" },
      { label: "Images", value: "8" },
      { label: "Images Missing Alt Text", value: "2" },
      { label: "Unlabelled Controls", value: "1" },
      { label: "Horizontal Overflow", value: "Detected" },
      { label: "HTTPS", value: "Yes" },
    ])
  })

  it("gives every review decision its own outcome colour", () => {
    expect(reviewStatusVariant("Shortlisted")).toBe("success")
    expect(reviewStatusVariant("Rejected")).toBe("destructive")
    expect(reviewStatusVariant("Contacted")).toBe("info")
    expect(reviewStatusVariant("Archived")).toBe("secondary")
  })

  it("keeps the starting state neutral rather than colouring it as a result", () => {
    expect(reviewStatusVariant("Unreviewed")).toBe("outline")
    expect(reviewStatusVariant("SomethingAdded Later")).toBe("outline")
  })

  it("maps every status the review policy allows", () => {
    expect(Object.fromEntries(REVIEW_STATUSES.map((s) => [s, reviewStatusVariant(s)]))).toEqual({
      Unreviewed: "outline",
      Shortlisted: "success",
      Rejected: "destructive",
      Contacted: "info",
      Archived: "secondary",
    })
  })
})

describe("queue filters", () => {
  const candidates = [
    row({ id: "a", locality: "Reda", primaryOpportunity: "NoDedicatedWebsite" }),
    row({ id: "b", locality: "Rumia", primaryOpportunity: "NoDedicatedWebsite" }),
    row({
      id: "c",
      locality: "Reda",
      primaryOpportunity: "BrokenOrUnusable",
      reviewStatus: "Shortlisted",
    }),
  ]

  it("offers only the values the queue actually holds", () => {
    expect(queueFilterOptions(candidates)).toEqual({
      localities: ["Reda", "Rumia"],
      opportunities: ["BrokenOrUnusable", "NoDedicatedWebsite"],
    })
  })

  it("narrows by town, opportunity and status together", () => {
    const ids = (filter: Parameters<typeof filterQueueCandidates>[1]) =>
      filterQueueCandidates(candidates, filter).map((candidate) => candidate.id)

    expect(ids(emptyQueueFilter)).toEqual(["a", "b", "c"])
    expect(ids({ ...emptyQueueFilter, locality: "Reda" })).toEqual(["a", "c"])
    expect(ids({ ...emptyQueueFilter, opportunity: "NoDedicatedWebsite" })).toEqual(["a", "b"])
    expect(ids({ ...emptyQueueFilter, locality: "Reda", status: "Shortlisted" })).toEqual(["c"])
  })

  it("knows whether anything is being held back", () => {
    expect(isQueueFiltered(emptyQueueFilter)).toBe(false)
    expect(isQueueFiltered({ ...emptyQueueFilter, locality: "Reda" })).toBe(true)
  })
})

function row(
  overrides: Readonly<{
    id: string
    locality: string
    primaryOpportunity: string
    reviewStatus?: string
  }>,
) {
  return { reviewStatus: "Unreviewed", ...overrides }
}
