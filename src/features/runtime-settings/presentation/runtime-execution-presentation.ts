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

/** Present stored CLI effort identifiers as reader-facing labels. */
export function reasoningEffortLabel(effort: RuntimeReasoningEffort): string {
  return labels[effort]
}

/** Preserve unknown or retired model slugs instead of inventing a label. */
export function runtimeModelLabel(runtimeId: RuntimeId, model: string): string {
  return runtimeModelOptions(runtimeId).find((option) => option.value === model)?.label ?? model
}

/** Omit the stored `none` effort because it is not a reader-facing value. */
export function runtimeExecutionLabel(
  runtimeId: RuntimeId,
  configuration: Readonly<{ model: string; reasoningEffort: RuntimeReasoningEffort }>,
): string {
  const model = runtimeModelLabel(runtimeId, configuration.model)
  if (configuration.reasoningEffort === "none") return model
  return `${model} · ${reasoningEffortLabel(configuration.reasoningEffort)} Reasoning`
}
