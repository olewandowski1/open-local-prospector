import type {
  RuntimeCommandResult,
  RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"

// Neither CLI exposes a check-without-install mode, so the application reports only what the CLI did.
export const RUNTIME_UPDATE_ARGUMENTS = ["update"] as const

export const RUNTIME_UPDATE_TIMEOUT_MILLISECONDS = 180_000

export type RuntimeUpdateOutcome = "Updated" | "Already Current" | "Failed"

export type RuntimeUpdateResult = Readonly<{
  outcome: RuntimeUpdateOutcome
  detail: string
  version?: string
  // This application never runs a shell on a CLI's behalf, so the manual command is offered instead.
  terminalInstruction?: string
}>

const alreadyCurrentPattern =
  /\b(already (up[- ]?to[- ]?date|current|on the latest)|no update(s)? (are |is )?available|latest version)\b/iu

const MAX_DETAIL_LENGTH = 400

// Output is provider-controlled text: only ever matched against and echoed, never executed or interpolated.
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

function summarize(output: string): string {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.slice(-3).join(" ").slice(0, MAX_DETAIL_LENGTH)
}

// All three CLIs publish to npm, the one place an available update is visible without installing it.
export const RUNTIME_PACKAGES: Readonly<Record<RuntimeId, string>> = {
  codex: "@openai/codex",
  claude: "@anthropic-ai/claude-code",
  opencode: "opencode-ai",
}

export type RuntimeUpdateStatus = Readonly<{
  runtimeId: RuntimeId
  label: string
  installed?: string
  latest?: string
  updateAvailable: boolean
  checked: boolean
}>

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

export function isUpdateAvailable(installed?: string, latest?: string): boolean {
  if (!installed || !latest) return false
  return compareVersions(latest, installed) > 0
}

export function terminalCommand(instruction: string): string {
  return instruction.replace(/^run:\s*/iu, "").trim()
}
