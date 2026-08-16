import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { decodeSearchBrief } from "@/features/prospecting-runs/domain/search-brief"

const validBrief = {
  location: "Kraków",
  category: "Dental clinics",
  targetCount: 10,
  mode: "Quick",
  runtime: "codex",
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
})
