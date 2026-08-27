import type { RuntimeId } from "@/features/runtime-settings/application/runtime-readiness"

export type RuntimeReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | "ultra"

export type RuntimeExecutionConfiguration = Readonly<{
  model: string
  reasoningEffort: RuntimeReasoningEffort
}>

export type RuntimeModelOption = Readonly<{
  value: string
  label: string
  detail: string
  reasoningEfforts: readonly RuntimeReasoningEffort[]
}>

// Mirror the 2026-08 Codex model manifest while retaining retired stored effort values.
const solEfforts: readonly RuntimeReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"]
const terraEfforts: readonly RuntimeReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]
const lunaEfforts: readonly RuntimeReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"]

// OpenCode calls the effort a model variant and passes it through as `--variant`.
const oxEfforts: readonly RuntimeReasoningEffort[] = ["low", "high", "max"]

// Claude Code passes the effort through as `--effort`.
const claudeEfforts: readonly RuntimeReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"]

const models: Readonly<Record<RuntimeId, readonly RuntimeModelOption[]>> = {
  codex: [
    {
      value: "gpt-5.6-sol",
      label: "GPT-5.6 Sol",
      detail: "Frontier Codex model for complex agentic work.",
      reasoningEfforts: solEfforts,
    },
    {
      value: "gpt-5.6-terra",
      label: "GPT-5.6 Terra",
      detail: "Balanced Codex model for everyday agentic work.",
      reasoningEfforts: terraEfforts,
    },
    {
      value: "gpt-5.6-luna",
      label: "GPT-5.6 Luna",
      detail: "Fast, lightweight Codex model.",
      reasoningEfforts: lunaEfforts,
    },
  ],
  claude: [
    {
      value: "claude-opus-5",
      label: "Opus 5",
      detail: "Highest capability and highest subscription usage.",
      reasoningEfforts: claudeEfforts,
    },
    {
      value: "claude-sonnet-5",
      label: "Sonnet 5",
      detail: "Balanced speed and capability.",
      reasoningEfforts: claudeEfforts,
    },
    {
      value: "claude-haiku-4-5",
      label: "Haiku 4.5",
      detail: "Fastest and lightest option. Does not accept a reasoning effort.",
      reasoningEfforts: [],
    },
  ],
  opencode: [
    {
      value: "opencode/x-preview-f-free",
      label: "Ox Alpha Free",
      detail: "Unlimited hosted model with web search. Runs without a provider login.",
      reasoningEfforts: oxEfforts,
    },
  ],
}

const defaults: Readonly<Record<RuntimeId, RuntimeExecutionConfiguration>> = {
  codex: { model: "gpt-5.6-luna", reasoningEffort: "max" },
  claude: { model: "claude-sonnet-5", reasoningEffort: "high" },
  opencode: { model: "opencode/x-preview-f-free", reasoningEffort: "high" },
}

export function runtimeModelOptions(runtimeId: RuntimeId): readonly RuntimeModelOption[] {
  return models[runtimeId]
}

export function runtimeReasoningEfforts(
  runtimeId: RuntimeId,
  model: string,
): readonly RuntimeReasoningEffort[] {
  return models[runtimeId].find((option) => option.value === model)?.reasoningEfforts ?? []
}

export function supportsReasoningEffort(runtimeId: RuntimeId, model: string): boolean {
  return runtimeReasoningEfforts(runtimeId, model).length > 0
}

export function defaultRuntimeExecutionConfiguration(
  runtimeId: RuntimeId,
): RuntimeExecutionConfiguration {
  return defaults[runtimeId]
}

export function resolveRuntimeConfiguration(
  runtimeId: RuntimeId,
  model: string,
  preferredEffort?: RuntimeReasoningEffort,
): RuntimeExecutionConfiguration {
  const efforts = runtimeReasoningEfforts(runtimeId, model)
  if (efforts.length === 0) return { model, reasoningEffort: "none" }
  const fallback = defaults[runtimeId].reasoningEffort
  if (preferredEffort && efforts.includes(preferredEffort)) {
    return { model, reasoningEffort: preferredEffort }
  }
  return { model, reasoningEffort: efforts.includes(fallback) ? fallback : efforts[0] }
}

export function isRuntimeExecutionConfiguration(
  runtimeId: RuntimeId,
  value: unknown,
): value is RuntimeExecutionConfiguration {
  if (!isRecord(value)) return false
  if (typeof value.model !== "string") return false
  const efforts = runtimeReasoningEfforts(runtimeId, value.model)
  if (!models[runtimeId].some((model) => model.value === value.model)) return false
  return efforts.length === 0
    ? value.reasoningEffort === "none"
    : efforts.includes(value.reasoningEffort as RuntimeReasoningEffort)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
