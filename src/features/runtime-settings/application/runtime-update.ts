import type { RuntimeCommandResult } from "@/features/runtime-settings/application/runtime-readiness"

/**
 * Each provider CLI performs its own update check and install. Neither Codex nor Claude Code exposes
 * a check-without-install mode, so the application never claims an update is available; it reports
 * exactly what the CLI did.
 */
export const RUNTIME_UPDATE_ARGUMENTS = ["update"] as const

/** Updates fetch and install a release, so they need far longer than a readiness probe. */
export const RUNTIME_UPDATE_TIMEOUT_MILLISECONDS = 180_000

export type RuntimeUpdateOutcome = "Updated" | "Already Current" | "Failed"

export type RuntimeUpdateResult = Readonly<{
  outcome: RuntimeUpdateOutcome
  /** The CLI's own words, trimmed and bounded, never a message the application invented. */
  detail: string
  version?: string
}>

const alreadyCurrentPattern =
  /\b(already (up[- ]?to[- ]?date|current|on the latest)|no update(s)? (are |is )?available|latest version)\b/iu

const MAX_DETAIL_LENGTH = 400

/**
 * Classifies a finished update command. Output is provider-controlled text, so it is only ever
 * matched against and echoed, never executed or interpolated anywhere.
 */
export function interpretUpdateResult(
  result: RuntimeCommandResult,
  versionAfter?: string,
): RuntimeUpdateResult {
  const output = `${result.stdout}\n${result.stderr}`.trim()
  const detail = summarize(output)

  if (result.exitCode !== 0) {
    return { outcome: "Failed", detail: detail || "The runtime reported a failure." }
  }
  const outcome: RuntimeUpdateOutcome = alreadyCurrentPattern.test(output)
    ? "Already Current"
    : "Updated"
  return {
    outcome,
    detail: detail || "The runtime reported no output.",
    ...(versionAfter ? { version: versionAfter } : {}),
  }
}

/** Keeps the last meaningful lines, which is where these CLIs put their conclusion. */
function summarize(output: string): string {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.slice(-3).join(" ").slice(0, MAX_DETAIL_LENGTH)
}
