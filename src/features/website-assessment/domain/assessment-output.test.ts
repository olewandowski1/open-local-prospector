import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { decodeAssessmentOutput } from "@/features/website-assessment/domain/assessment-output"

const sourceUrl = "https://fixture.test/"
const valid = {
  schemaVersion: "assessment-output-v1",
  assessmentState: "Completed",
  summary: "The page has a difficult conversion path.",
  apparentCommercialValue: 0.7,
  opportunities: [
    {
      class: "ConfusingConversionJourney",
      severity: 3,
      confidence: 0.8,
      observableEffect: "ConversionFlow",
      explanation: "The booking action is hard to locate.",
      observations: [
        {
          statement: "No booking link appears in the navigation.",
          sourceUrl,
          observedAt: "2026-08-16T10:00:00.000Z",
          evidenceState: "AIAssessment",
          confidence: 0.8,
        },
      ],
    },
  ],
} as const

describe("assessment output boundary", () => {
  it("accepts a cited assessment", async () => {
    await expect(
      Effect.runPromise(decodeAssessmentOutput(valid, new Set([sourceUrl]))),
    ).resolves.toMatchObject(valid)
  })

  it.each([
    ["out-of-stage output", { ...valid, action: "contact the business" }],
    [
      "inferred contact data",
      { ...valid, opportunities: [{ ...valid.opportunities[0], email: "owner@example.test" }] },
    ],
    [
      "unsupported citation",
      {
        ...valid,
        opportunities: [
          {
            ...valid.opportunities[0],
            observations: [
              { ...valid.opportunities[0].observations[0], sourceUrl: "https://invented.test/" },
            ],
          },
        ],
      },
    ],
    [
      "missing citation",
      { ...valid, opportunities: [{ ...valid.opportunities[0], observations: [] }] },
    ],
    [
      "unsupported aesthetic label",
      { ...valid, opportunities: [{ ...valid.opportunities[0], observableEffect: "Ugly" }] },
    ],
  ])("rejects %s", async (_name, value) => {
    await expect(
      Effect.runPromise(decodeAssessmentOutput(value, new Set([sourceUrl]))),
    ).rejects.toBeDefined()
  })
})
