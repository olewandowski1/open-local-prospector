import { spawn } from "node:child_process"

import { Effect } from "effect"

import { AssessmentRuntimeError } from "@/features/website-assessment/application/assessment-runtime"

export type RuntimeProcessRequest = Readonly<{
  executable: string
  arguments: readonly string[]
  input: string
  cwd: string
  environment?: Readonly<Record<string, string | undefined>>
  timeoutMilliseconds?: number
  inputLimitBytes?: number
  outputLimitBytes?: number
}>

export type RuntimeProcessResult = Readonly<{ exitCode: number; stdout: string }>

export type RuntimeProcess = (
  request: RuntimeProcessRequest,
) => Effect.Effect<RuntimeProcessResult, AssessmentRuntimeError>

export const executeRuntimeProcess: RuntimeProcess = (request) => {
  const inputLimit = request.inputLimitBytes ?? 256 * 1024
  const outputLimit = request.outputLimitBytes ?? 128 * 1024
  const timeout = request.timeoutMilliseconds ?? 120_000
  if (Buffer.byteLength(request.input) > inputLimit) {
    return Effect.fail(
      runtimeError("Infrastructure", "input-limit", "Assessment input is too large."),
    )
  }
  return Effect.async<RuntimeProcessResult, AssessmentRuntimeError>((resume) => {
    let settled = false
    let outputBytes = 0
    const stdout: Buffer[] = []
    const finish = (effect: Effect.Effect<RuntimeProcessResult, AssessmentRuntimeError>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resume(effect)
    }
    const child = spawn(request.executable, [...request.arguments], {
      cwd: request.cwd,
      env: safeRuntimeEnvironment(request.environment ?? process.env),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const timer = setTimeout(() => {
      child.kill()
      finish(
        Effect.fail(runtimeError("Transient", "runtime-timeout", "Assessment runtime timed out.")),
      )
    }, timeout)
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength
      if (outputBytes > outputLimit) {
        child.kill()
        finish(
          Effect.fail(runtimeError("Transient", "output-limit", "Assessment output is too large.")),
        )
      } else stdout.push(chunk)
    })
    child.stderr.on("data", () => undefined)
    child.on("error", () =>
      finish(
        Effect.fail(
          runtimeError(
            "Blocked",
            "runtime-unavailable",
            "Assessment runtime could not be launched.",
          ),
        ),
      ),
    )
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        finish(
          Effect.fail(
            runtimeError(
              "Blocked",
              "runtime-failed",
              "Assessment runtime exited without a valid result.",
            ),
          ),
        )
      } else finish(Effect.succeed({ exitCode: 0, stdout: Buffer.concat(stdout).toString("utf8") }))
    })
    child.stdin.end(request.input)
    return Effect.sync(() => {
      if (!settled) child.kill()
    })
  })
}

function safeRuntimeEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "CODEX_HOME",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "LANG",
    "OPENCODE_PERMISSION",
    "OPENCODE_DISABLE_DEFAULT_PLUGINS",
    "OPENCODE_DISABLE_CLAUDE_CODE",
    "OPENCODE_DISABLE_LSP_DOWNLOAD",
    "OPENCODE_DISABLE_MODELS_FETCH",
  ] as const
  const safe: NodeJS.ProcessEnv = { NODE_ENV: "production" }
  for (const key of allowed) if (environment[key] !== undefined) safe[key] = environment[key]
  return safe
}

function runtimeError(
  classification: AssessmentRuntimeError["classification"],
  code: string,
  message: string,
) {
  return new AssessmentRuntimeError({ classification, code, message })
}
