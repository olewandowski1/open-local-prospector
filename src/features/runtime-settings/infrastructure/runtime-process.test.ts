import { describe, expect, it } from "vitest"

import { classifyRuntimeFailure } from "@/features/runtime-settings/infrastructure/runtime-process"

describe("runtime process diagnostics", () => {
  it("classifies strict structured-output schema failures without persisting stderr", () => {
    const secret = "sensitive-source-content"
    const failure = classifyRuntimeFailure(
      `user ${secret}\nERROR: {"error":{"code":"invalid_json_schema","message":"Missing description"}}`,
      1,
    )

    expect(failure).toMatchObject({
      classification: "Blocked",
      code: "runtime-invalid-json-schema",
    })
    expect(failure.message).not.toContain(secret)
    expect(failure.message).not.toContain("Missing description")
  })

  it("distinguishes provider rate limits and authentication failures", () => {
    expect(classifyRuntimeFailure("user text\nERROR: 429 too many requests", 1)).toMatchObject({
      classification: "Transient",
      code: "runtime-rate-limited",
    })
    expect(
      classifyRuntimeFailure("user text\nERROR: Authentication required: please log in", 1),
    ).toMatchObject({
      classification: "Blocked",
      code: "runtime-not-authenticated",
    })
  })

  it("never classifies untrusted prompt text as a provider diagnostic", () => {
    expect(classifyRuntimeFailure('user says "code":"invalid_json_schema"', 1)).toMatchObject({
      code: "runtime-failed",
    })
  })
})
