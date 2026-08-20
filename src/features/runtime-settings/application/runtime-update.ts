import type {
  RuntimeCommandResult,
  RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"

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
  /**
   * The command to run by hand when the CLI could not update itself. A CLI installed through a
   * package manager may not recognise how it was launched, and this application deliberately never
   * runs a shell on its behalf, so the manual path is offered instead.
   */
  terminalInstruction?: string
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

/**
 * Both CLIs publish their releases to npm, so the registry is the one place an available update can
 * be seen without installing it. The CLI remains the thing that performs the update.
 */
export const RUNTIME_PACKAGES: Readonly<Record<RuntimeId, string>> = {
  codex: "@openai/codex",
  claude: "@anthropic-ai/claude-code",
}

export type RuntimeUpdateStatus = Readonly<{
  runtimeId: RuntimeId
  label: string
  installed?: string
  latest?: string
  updateAvailable: boolean
  /** False when the executable or the registry could not be read; nothing is claimed then. */
  checked: boolean
}>

/** Numeric, segment-by-segment comparison. Returns 0 for anything it cannot read as a version. */
export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".")
  const rightParts = right.split(".")
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const a = Number.parseInt(leftParts[index] ?? "0", 10)
    const b = Number.parseInt(rightParts[index] ?? "0", 10)
    if (Number.isNaN(a) || Number.isNaN(b)) return 0
    if (a !== b) return a > b ? 1 : -1
  }
  return 0
}

/** An update is only ever claimed when both versions are known and the published one is higher. */
export function isUpdateAvailable(installed?: string, latest?: string): boolean {
  if (!installed || !latest) return false
  return compareVersions(latest, installed) > 0
}

/**
 * The bare command from an instruction. Instructions read as prose elsewhere in the interface, but a
 * command offered for copying has to paste into a terminal unaltered.
 */
export function terminalCommand(instruction: string): string {
  return instruction.replace(/^run:\s*/iu, "").trim()
}
