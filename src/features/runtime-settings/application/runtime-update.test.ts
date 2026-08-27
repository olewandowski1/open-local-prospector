import { describe, expect, it } from "vitest"
import {
  getRuntimeUpdateArguments,
  interpretUpdateResult,
} from "@/features/runtime-settings/application/runtime-update"

const result = (overrides: Partial<{ exitCode: number; stdout: string; stderr: string }> = {}) => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
  ...overrides,
})

describe("runtime update", () => {
  it("invokes each provider CLI's fixed updater command", () => {
    expect(getRuntimeUpdateArguments("codex")).toEqual(["update"])
    expect(getRuntimeUpdateArguments("claude")).toEqual(["install", "stable"])
    expect(getRuntimeUpdateArguments("opencode")).toEqual(["upgrade"])
  })

  it("reports a failure whenever the CLI exits non-zero", () => {
    expect(interpretUpdateResult(result({ exitCode: 1, stderr: "network unreachable" }))).toEqual({
      outcome: "Failed",
      detail: "network unreachable",
    })
  })

  it("distinguishes an installed update from one that was not needed", () => {
    expect(interpretUpdateResult(result({ stdout: "Codex is already up to date." })).outcome).toBe(
      "Already Current",
    )
    expect(interpretUpdateResult(result({ stdout: "No updates available." })).outcome).toBe(
      "Already Current",
    )
    expect(interpretUpdateResult(result({ stdout: "Installed 1.2.3" }), "1.2.3")).toMatchObject({
      outcome: "Updated",
      version: "1.2.3",
    })
  })

  it("echoes the CLI's own conclusion rather than inventing a message", () => {
    const interpreted = interpretUpdateResult(
      result({ stdout: "downloading\nverifying\nUpdated to 2.0.0" }),
    )

    expect(interpreted.detail).toBe("downloading verifying Updated to 2.0.0")
  })

  it("bounds provider output so a noisy CLI cannot flood the interface", () => {
    const interpreted = interpretUpdateResult(result({ stdout: "x".repeat(5_000) }))

    expect(interpreted.detail.length).toBeLessThanOrEqual(400)
  })

  it("says so plainly when the CLI printed nothing", () => {
    expect(interpretUpdateResult(result()).detail).toBe("The runtime reported no output.")
  })
})
