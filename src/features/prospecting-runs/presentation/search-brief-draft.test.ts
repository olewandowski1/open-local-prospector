import { describe, expect, it } from "vitest"

import {
  initialSearchBriefDraft,
  serializeSearchBriefDraft,
} from "@/features/prospecting-runs/presentation/search-brief-draft"

const runtime = {
  runtimeId: "codex",
  label: "Codex",
  status: "Ready",
  detail: "Ready",
} as const

describe("Search Brief draft presentation", () => {
  it("uses a ready selected runtime and preserves preset defaults", () => {
    const draft = initialSearchBriefDraft(
      { category: "Restaurants", targetCount: 25, mode: "Thorough", radiusKm: 12 },
      [runtime],
      "codex",
    )
    expect(draft).toMatchObject({
      categoryChoice: "Restaurants",
      customCategory: "",
      targetCount: "25",
      mode: "Thorough",
      radiusKm: "12",
      runtime: "codex",
    })
  })

  it("falls back to a custom category and the first ready runtime", () => {
    const draft = initialSearchBriefDraft(
      { category: "Independent gyms", targetCount: 10, mode: "Quick" },
      [runtime],
      undefined,
    )
    expect(draft).toMatchObject({
      categoryChoice: "Custom category",
      customCategory: "Independent gyms",
      runtime: "codex",
    })
  })

  it("serializes numeric fields while omitting an empty optional radius", () => {
    const draft = initialSearchBriefDraft(undefined, [runtime], "codex")
    expect(serializeSearchBriefDraft({ ...draft, location: "Gdańsk", targetCount: "15" })).toEqual(
      expect.objectContaining({ location: "Gdańsk", targetCount: 15, category: "Dental clinics" }),
    )
    expect(serializeSearchBriefDraft(draft)).not.toHaveProperty("radiusKm")
  })
})
