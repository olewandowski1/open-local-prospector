import { describe, expect, it } from "vitest"
import type { RuntimeReasoningEffort } from "@/features/runtime-settings/application/runtime-execution-configuration"
import {
  reasoningEffortLabel,
  runtimeModelLabel,
} from "@/features/runtime-settings/presentation/runtime-execution-presentation"

describe("reasoningEffortLabel", () => {
  it("reads every effort as words rather than an identifier", () => {
    const efforts: readonly RuntimeReasoningEffort[] = [
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
      "ultra",
    ]
    expect(efforts.map(reasoningEffortLabel)).toEqual([
      "None",
      "Minimal",
      "Low",
      "Medium",
      "High",
      "Extra High",
      "Max",
      "Ultra",
    ])
  })
})

describe("runtimeModelLabel", () => {
  it("names a known model the way the run form offered it", () => {
    expect(runtimeModelLabel("codex", "gpt-5.6-luna")).toBe("GPT-5.6 Luna")
    expect(runtimeModelLabel("claude", "claude-sonnet-5")).toBe("Sonnet 5")
  })

  it("keeps the slug of a model it does not know rather than inventing a name", () => {
    expect(runtimeModelLabel("codex", "gpt-reserve")).toBe("gpt-reserve")
  })
})
