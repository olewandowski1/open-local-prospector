import { describe, expect, it } from "vitest"
import {
  defaultRuntimeExecutionConfiguration,
  isRuntimeExecutionConfiguration,
  resolveRuntimeConfiguration,
  runtimeModelOptions,
  runtimeReasoningEfforts,
  supportsReasoningEffort,
} from "@/features/runtime-settings/application/runtime-execution-configuration"
import { runtimeIds } from "@/features/runtime-settings/application/runtime-readiness"

describe("runtime execution configuration", () => {
  it("offers only OpenAI and Anthropic subscription runtimes", () => {
    expect(runtimeIds).toEqual(["codex", "claude"])
  })

  it("names Claude models with their versions", () => {
    expect(runtimeModelOptions("claude").map((model) => model.value)).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ])
  })

  it("exposes the effort ladder each model actually accepts", () => {
    expect(runtimeReasoningEfforts("claude", "claude-opus-5")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ])
    expect(runtimeReasoningEfforts("codex", "gpt-5.6-sol")).toContain("minimal")
    expect(runtimeReasoningEfforts("codex", "gpt-5.6-sol")).not.toContain("max")
  })

  it("reports models that take no reasoning effort", () => {
    expect(supportsReasoningEffort("claude", "claude-haiku-4-5")).toBe(false)
    expect(runtimeReasoningEfforts("claude", "claude-haiku-4-5")).toEqual([])
    expect(supportsReasoningEffort("claude", "claude-sonnet-5")).toBe(true)
  })

  it("keeps a preferred effort the new model still supports", () => {
    expect(resolveRuntimeConfiguration("claude", "claude-opus-5", "max")).toEqual({
      model: "claude-opus-5",
      reasoningEffort: "max",
    })
  })

  it("falls back to a supported effort when the preferred one is not offered", () => {
    expect(resolveRuntimeConfiguration("claude", "claude-opus-5", "minimal")).toEqual({
      model: "claude-opus-5",
      reasoningEffort: "high",
    })
    expect(resolveRuntimeConfiguration("claude", "claude-haiku-4-5", "high")).toEqual({
      model: "claude-haiku-4-5",
      reasoningEffort: "none",
    })
  })

  it("rejects an effort the selected model does not accept", () => {
    expect(
      isRuntimeExecutionConfiguration("claude", {
        model: "claude-haiku-4-5",
        reasoningEffort: "high",
      }),
    ).toBe(false)
    expect(
      isRuntimeExecutionConfiguration("claude", {
        model: "claude-opus-5",
        reasoningEffort: "none",
      }),
    ).toBe(false)
    expect(
      isRuntimeExecutionConfiguration("claude", { model: "sonnet", reasoningEffort: "high" }),
    ).toBe(false)
  })

  it("accepts every runtime default", () => {
    for (const runtimeId of runtimeIds) {
      expect(
        isRuntimeExecutionConfiguration(runtimeId, defaultRuntimeExecutionConfiguration(runtimeId)),
      ).toBe(true)
    }
  })
})
