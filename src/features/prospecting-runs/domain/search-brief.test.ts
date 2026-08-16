import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  decodeSearchBrief,
  decodeSearchBriefDraft,
} from "@/features/prospecting-runs/domain/search-brief"

const validBrief = {
  location: "Kraków",
  category: "Dental clinics",
  targetCount: 10,
  mode: "Quick",
  runtime: "codex",
  searchArea: {
    id: "relation:276892",
    displayName: "Kraków, województwo małopolskie, Polska",
    latitude: 50.0614,
    longitude: 19.9366,
    countryCode: "PL",
  },
}

describe("Search Brief", () => {
  it.each([5, 50])("accepts boundary target %i", async (targetCount) => {
    const result = await Effect.runPromise(decodeSearchBrief({ ...validBrief, targetCount }))
    expect(result.targetCount).toBe(targetCount)
  })

  it.each([4, 51])("rejects target %i", async (targetCount) => {
    expect(
      (await Effect.runPromiseExit(decodeSearchBrief({ ...validBrief, targetCount })))._tag,
    ).toBe("Failure")
  })

  it("trims text and accepts Thorough mode", async () => {
    const result = await Effect.runPromise(
      decodeSearchBrief({ ...validBrief, location: "  Gdańsk  ", mode: "Thorough" }),
    )
    expect(result.location).toBe("Gdańsk")
    expect(result.mode).toBe("Thorough")
  })

  it.each(["location", "category", "runtime"])("rejects blank %s", async (field) => {
    expect(
      (await Effect.runPromiseExit(decodeSearchBrief({ ...validBrief, [field]: "  " })))._tag,
    ).toBe("Failure")
  })

  it.each(["codex", "claude", "opencode"])("accepts supported runtime %s", async (runtime) => {
    const result = await Effect.runPromise(decodeSearchBrief({ ...validBrief, runtime }))
    expect(result.runtime).toBe(runtime)
  })

  it("rejects an unsupported runtime", async () => {
    expect(
      (await Effect.runPromiseExit(decodeSearchBrief({ ...validBrief, runtime: "openrouter" })))
        ._tag,
    ).toBe("Failure")
  })

  it("accepts a valid location outside Poland", async () => {
    const result = await Effect.runPromise(
      decodeSearchBrief({
        ...validBrief,
        location: "Berlin, Germany",
        searchArea: {
          id: "relation:62422",
          displayName: "Berlin, Deutschland",
          latitude: 52.517,
          longitude: 13.3889,
          countryCode: "DE",
        },
      }),
    )

    expect(result.searchArea.countryCode).toBe("DE")
  })

  it("decodes an unconfirmed draft without a Search Area", async () => {
    const { searchArea: _searchArea, ...draft } = validBrief
    const result = await Effect.runPromise(decodeSearchBriefDraft(draft))

    expect(result.location).toBe("Kraków")
    expect("searchArea" in result).toBe(false)
  })
})
