import { tmpdir } from "node:os"

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  classifyRuntimeFailure,
  describeUnreadableOutput,
  executeRuntimeProcess,
} from "@/features/runtime-settings/infrastructure/runtime-process"

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

describe("executeRuntimeProcess", () => {
  // A descendant inheriting stdout outlives its parent, so stdio never closes even though the
  // answer is complete; this is how OpenCode behaves after every call.
  const holdsThePipe = `console.log("done"); require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], { stdio: ["ignore", "inherit", "inherit"] }).unref()`

  it("settles shortly after exit when a descendant keeps the output pipes open", async () => {
    const result = await Effect.runPromise(
      executeRuntimeProcess({
        executable: process.execPath,
        arguments: ["-e", holdsThePipe],
        input: "",
        cwd: tmpdir(),
        timeoutMilliseconds: 30_000,
        settleOnExitMilliseconds: 500,
      }),
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("done")
  }, 20_000)
})

describe("describeUnreadableOutput", () => {
  it("tells silence apart from prose and from a cut-off answer", () => {
    expect(describeUnreadableOutput("")).toBe("the runtime wrote nothing")
    expect(describeUnreadableOutput("I could not assess this.")).toBe(
      "24 bytes, holding no JSON object",
    )
    expect(describeUnreadableOutput('{"a": 1')).toBe(
      "7 bytes, holding an object that was never closed",
    )
    expect(describeUnreadableOutput('{"a": }')).toBe(
      "7 bytes, holding an object that did not parse",
    )
  })
})
