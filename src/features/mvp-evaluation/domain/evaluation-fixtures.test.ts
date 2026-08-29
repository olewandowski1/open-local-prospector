import { describe, expect, it } from "vitest"

import {
  assertQualityFixtureContract,
  evaluateQualityFixtures,
  MVP_EVALUATION_VERSION,
  qualityFixtures,
  qualityFixtureVersions,
} from "@/features/mvp-evaluation"

const opportunityClasses = [
  "BrokenOrUnusable",
  "ConfusingConversionJourney",
  "MobileAccessibilityOrPerformance",
  "NoDedicatedWebsite",
  "OutdatedPresentation",
  "WeakDiscoverability",
]

describe(MVP_EVALUATION_VERSION, () => {
  it("replays structured attribution and identity decisions through production boundaries", async () => {
    const evaluation = await evaluateQualityFixtures()
    const result = evaluation.discoveryResults[0]
    if (!result) throw new Error("Expected discovery fixture result")

    expect(result.identities.map(({ name, actualStatus }) => ({ name, actualStatus }))).toEqual(
      result.identities.map(({ name, expectedStatus }) => ({
        name,
        actualStatus: expectedStatus,
      })),
    )
    expect(new Set(result.rejectionReasons)).toEqual(
      new Set(["not-beside-its-source", "prefix-not-in-numbering-plan", "not-in-report"]),
    )
    const fixture = qualityFixtures.discovery[0]
    if (!fixture) throw new Error("Expected discovery fixture")
    const distinctFingerprints = fixture.expectedDistinctCanonicalNames.map(
      (name) => result.identities.find((identity) => identity.name === name)?.canonicalFingerprint,
    )
    expect(distinctFingerprints.every(Boolean)).toBe(true)
    expect(new Set(distinctFingerprints).size).toBe(distinctFingerprints.length)
    expect(evaluation.metrics.acceptedIdentityCount).toBeGreaterThan(0)
    expect(evaluation.metrics.acceptedIdentityCount).toBeGreaterThanOrEqual(10)
    expect(evaluation.metrics.identityPrecision).toBeGreaterThanOrEqual(0.9)
  })

  it("replays assessment schema, citation, timestamp, scoring, and qualification behavior", async () => {
    const evaluation = await evaluateQualityFixtures()

    for (const fixture of qualityFixtures.assessments) {
      expect(evaluation.assessmentResults.find((result) => result.id === fixture.id)).toMatchObject(
        fixture.expected,
      )
    }
    expect(evaluation.metrics.opportunityClassCoverage).toEqual(opportunityClasses)
    expect(evaluation.metrics.unsupportedClaimRejectionCount).toBe(2)
    expect(
      evaluation.assessmentResults.find((result) => result.id === "threshold-at"),
    ).toMatchObject({ score: 72, qualified: true })
    expect(
      evaluation.assessmentResults.find((result) => result.id === "threshold-below"),
    ).toMatchObject({ score: 71, qualified: false })
  })

  it("reports stable versioned metrics on repeated runs", async () => {
    const first = await evaluateQualityFixtures()
    const second = await evaluateQualityFixtures()

    expect(first).toEqual(second)
    expect(first.versions).toEqual(qualityFixtureVersions)
    expect(first.metrics).toEqual({
      acceptedIdentityCount: 12,
      correctIdentityCount: 12,
      identityPrecision: 1,
      unsupportedClaimRejectionCount: 2,
      opportunityClassCoverage: opportunityClasses,
      qualifiedCases: 10,
      nonQualifiedCases: 3,
    })
  })

  it("rejects missing version metadata and non-reserved contact sources", () => {
    expect(() =>
      assertQualityFixtureContract({
        ...qualityFixtures,
        versions: { ...qualityFixtureVersions, assessmentSchema: "" },
      }),
    ).toThrow("Fixture version assessmentSchema is required.")
    expect(() =>
      assertQualityFixtureContract({
        versions: qualityFixtureVersions,
        sourceUrl: "https://real-example.com/",
      }),
    ).toThrow("Fixture URLs must use reserved .test hosts.")
    expect(() =>
      assertQualityFixtureContract({
        versions: qualityFixtureVersions,
        contact: "person@example.com",
      }),
    ).toThrow("Fixture emails must use reserved .test hosts.")
    expect(() =>
      assertQualityFixtureContract({
        versions: qualityFixtureVersions,
        telephone: "+48500123456",
      }),
    ).toThrow("Fixture telephone is not an approved synthetic rejection value.")
  })
})
