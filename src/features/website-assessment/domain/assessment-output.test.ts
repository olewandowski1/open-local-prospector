import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { decodeAssessmentOutput } from "@/features/website-assessment/domain/assessment-output"

const sourceUrl = "https://fixture.test/"
const observedAt = "2026-08-16T10:00:00.000Z"
const laterObservedAt = "2026-08-16T10:05:00.000Z"
const citations = new Map([[sourceUrl, new Set([observedAt, laterObservedAt])]])
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
          observedAt,
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
      Effect.runPromise(decodeAssessmentOutput(valid, citations)),
    ).resolves.toMatchObject(valid)
  })

  it("accepts either exact time supplied for one normalized URL", async () => {
    const value = observation({ sourceUrl: `${sourceUrl}#rendered`, observedAt: laterObservedAt })
    await expect(
      Effect.runPromise(decodeAssessmentOutput(value, citations)),
    ).resolves.toMatchObject(value)
  })

  it("rejects an invented time for an allowed URL as an unsupported claim", async () => {
    const value = observation({ observedAt: "2026-08-16T10:00:01.000Z" })
    await expect(
      Effect.runPromise(Effect.flip(decodeAssessmentOutput(value, citations))),
    ).resolves.toMatchObject({ code: "unsupported-claim" })
  })

  it("rejects an unknown URL even when its time is allowed", async () => {
    const value = observation({ sourceUrl: "https://invented.test/" })
    await expect(
      Effect.runPromise(Effect.flip(decodeAssessmentOutput(value, citations))),
    ).resolves.toMatchObject({ code: "unsupported-claim" })
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
    await expect(Effect.runPromise(decodeAssessmentOutput(value, citations))).rejects.toBeDefined()
  })
})

function observation(values: { sourceUrl?: string; observedAt?: string }) {
  return {
    ...valid,
    opportunities: [
      {
        ...valid.opportunities[0],
        observations: [{ ...valid.opportunities[0].observations[0], ...values }],
      },
    ],
  }
}
