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
  it("offers OpenAI, Anthropic, and OpenCode subscription runtimes", () => {
    expect(runtimeIds).toEqual(["codex", "claude", "opencode"])
  })

  it("names Claude models with their versions", () => {
    expect(runtimeModelOptions("claude").map((model) => model.value)).toEqual([
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ])
  })

  it("offers the hosted OpenCode model that runs without a provider login", () => {
    expect(runtimeModelOptions("opencode")).toEqual([
      {
        value: "opencode/x-preview-f-free",
        label: "Ox Alpha Free",
        detail: expect.any(String),
        reasoningEfforts: ["low", "high", "max"],
      },
    ])
    expect(defaultRuntimeExecutionConfiguration("opencode")).toEqual({
      model: "opencode/x-preview-f-free",
      reasoningEffort: "high",
    })
  })

  it("exposes the effort ladder each model actually accepts", () => {
    expect(runtimeReasoningEfforts("claude", "claude-opus-5")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ])
    expect(runtimeReasoningEfforts("codex", "gpt-5.6-sol")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ])
  })

  it("offers Ultra where the model manifest documents it and Max on every current Codex model", () => {
    expect(runtimeReasoningEfforts("codex", "gpt-5.6-terra")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
      "ultra",
    ])
    expect(runtimeReasoningEfforts("codex", "gpt-5.6-luna")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ])
    for (const model of ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]) {
      expect(runtimeReasoningEfforts("codex", model)).not.toContain("none")
      expect(runtimeReasoningEfforts("codex", model)).not.toContain("minimal")
    }
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

  // OpenCode calls the effort a model variant, and the hosted model offers three of them.
  it("accepts the variants Ox Alpha Free offers and nothing else", () => {
    for (const reasoningEffort of ["low", "high", "max"] as const) {
      expect(
        isRuntimeExecutionConfiguration("opencode", {
          model: "opencode/x-preview-f-free",
          reasoningEffort,
        }),
      ).toBe(true)
    }
    expect(
      isRuntimeExecutionConfiguration("opencode", {
        model: "opencode/x-preview-f-free",
        reasoningEffort: "none",
      }),
    ).toBe(false)
    expect(
      isRuntimeExecutionConfiguration("opencode", {
        model: "opencode/x-preview-f-free",
        reasoningEffort: "medium",
      }),
    ).toBe(false)
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
