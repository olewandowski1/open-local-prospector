import { describe, expect, it } from "vitest"
import { evaluateBusinessIdentity } from "@/features/business-identity"
import {
  identityFixtures,
  MVP_EVALUATION_VERSION,
  opportunityFixtures,
  siteConditionFixtures,
} from "@/features/mvp-evaluation/domain/evaluation-fixtures"

describe(MVP_EVALUATION_VERSION, () => {
  it("covers Polish evidence, every opportunity class, no-site, strong, and inaccessible sites", () => {
    expect(new Set(opportunityFixtures.map((fixture) => fixture.class))).toEqual(
      new Set([
        "NoDedicatedWebsite",
        "BrokenOrUnusable",
        "OutdatedPresentation",
        "MobileAccessibilityOrPerformance",
        "WeakDiscoverability",
        "ConfusingConversionJourney",
      ]),
    )
    expect(opportunityFixtures.some((fixture) => fixture.websiteState === "NoWebsite")).toBe(true)
    expect(siteConditionFixtures.map((fixture) => fixture.id)).toEqual([
      "strong-existing-site",
      "inaccessible-site",
    ])
    expect(opportunityFixtures.some((fixture) => /[ąćęłńóśźż]/iu.test(fixture.sourceContent))).toBe(
      true,
    )
  })

  it("measures at least 90% identity precision without confirming ambiguous or false-positive identities", () => {
    const results = identityFixtures.map((fixture) => ({
      fixture,
      evaluation: evaluateBusinessIdentity({
        business: fixture.business,
        countryCode: "PL",
        collectedAt: new Date("2026-08-16T10:00:00.000Z"),
      }),
    }))
    const confirmed = results.filter((result) => result.evaluation.status === "Eligible")
    const truePositive = confirmed.filter((result) => result.fixture.expectedConfirmed).length
    const precision = confirmed.length === 0 ? 0 : truePositive / confirmed.length
    expect(precision).toBeGreaterThanOrEqual(0.9)
    expect(
      results
        .filter((result) => !result.fixture.expectedConfirmed)
        .every((result) => result.evaluation.status !== "Eligible"),
    ).toBe(true)
  })

  it("requires a source-linked observation for every opportunity fixture and no inferred contact", () => {
    const outputs = opportunityFixtures.map((fixture) => ({
      class: fixture.class,
      observations: [
        { sourceUrl: `https://${fixture.id}.example/`, observedAt: "2026-08-16T10:00:00.000Z" },
      ],
    }))
    expect(
      outputs.every(
        (output) =>
          output.observations.length > 0 &&
          output.observations.every((observation) => observation.sourceUrl.startsWith("https://")),
      ),
    ).toBe(true)
    expect(outputs.some((output) => "contact" in output)).toBe(false)
  })
})
