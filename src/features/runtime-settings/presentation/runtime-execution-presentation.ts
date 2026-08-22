import type { RuntimeReasoningEffort } from "@/features/runtime-settings/application/runtime-execution-configuration"
import { runtimeModelOptions } from "@/features/runtime-settings/application/runtime-execution-configuration"
import type { RuntimeId } from "@/features/runtime-settings/application/runtime-readiness"

const labels: Record<RuntimeReasoningEffort, string> = {
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
  ultra: "Ultra",
}

/**
 * The stored value is the CLI identifier (`xhigh`); the label is what a reader reads. Capitalising
 * the raw value would announce "Xhigh", which is not a word.
 */
export function reasoningEffortLabel(effort: RuntimeReasoningEffort): string {
  return labels[effort]
}

/**
 * The stored value is the CLI slug (`gpt-5.6-sol`); the label is what the run form offered
 * ("GPT-5.6 Sol"). An unrecorded or retired model keeps its slug rather than lying about a name.
 */
export function runtimeModelLabel(runtimeId: RuntimeId, model: string): string {
  return runtimeModelOptions(runtimeId).find((option) => option.value === model)?.label ?? model
}

/**
 * A model that takes no reasoning effort stores `none`, and printing that reads as a missing
 * value rather than as the fact that there is nothing to choose. Say the model and stop.
 */
export function runtimeExecutionLabel(
  runtimeId: RuntimeId,
  configuration: Readonly<{ model: string; reasoningEffort: RuntimeReasoningEffort }>,
): string {
  const model = runtimeModelLabel(runtimeId, configuration.model)
  if (configuration.reasoningEffort === "none") return model
  return `${model} · ${reasoningEffortLabel(configuration.reasoningEffort)} Reasoning`
}
