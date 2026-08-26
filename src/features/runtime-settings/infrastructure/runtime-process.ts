import { spawn } from "node:child_process"

import { Data, Effect } from "effect"

export class RuntimeProcessError extends Data.TaggedError("RuntimeProcessError")<{
  readonly classification: "Transient" | "Blocked" | "Infrastructure"
  readonly code: string
  readonly message: string
}> {}

export type RuntimeProcessRequest = Readonly<{
  executable: string
  arguments: readonly string[]
  input: string
  cwd: string
  environment?: Readonly<Record<string, string | undefined>>
  timeoutMilliseconds?: number
  inputLimitBytes?: number
  outputLimitBytes?: number
  /**
   * Settle this long after the process exits rather than when its output pipes close. A CLI that
   * leaves a helper process holding inherited stdio never produces "close", even though its
   * answer is complete and its exit code final; waiting for close only burns the timeout.
   */
  settleOnExitMilliseconds?: number
}>

export type RuntimeProcessResult = Readonly<{ exitCode: number; stdout: string }>

export type RuntimeProcess = (
  request: RuntimeProcessRequest,
) => Effect.Effect<RuntimeProcessResult, RuntimeProcessError>

export const executeRuntimeProcess: RuntimeProcess = (request) => {
  const inputLimit = request.inputLimitBytes ?? 256 * 1024
  const outputLimit = request.outputLimitBytes ?? 128 * 1024
  const timeout = request.timeoutMilliseconds ?? 120_000
  if (Buffer.byteLength(request.input) > inputLimit) {
    return Effect.fail(runtimeError("Infrastructure", "input-limit", "Runtime input is too large."))
  }
  return Effect.async<RuntimeProcessResult, RuntimeProcessError>((resume) => {
    let settled = false
    let outputBytes = 0
    const stdout: Buffer[] = []
    let stderrTail = Buffer.alloc(0)
    const finish = (effect: Effect.Effect<RuntimeProcessResult, RuntimeProcessError>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resume(effect)
    }
    const child = spawn(request.executable, [...request.arguments], {
      cwd: request.cwd,
      env: safeRuntimeEnvironment({ ...process.env, ...request.environment }),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const timer = setTimeout(() => {
      child.kill()
      finish(Effect.fail(runtimeError("Transient", "runtime-timeout", "Runtime timed out.")))
    }, timeout)
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength
      if (outputBytes > outputLimit) {
        child.kill()
        finish(
          Effect.fail(runtimeError("Transient", "output-limit", "Runtime output is too large.")),
        )
      } else stdout.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = Buffer.concat([stderrTail, chunk])
      if (stderrTail.byteLength > 32 * 1024) stderrTail = stderrTail.subarray(-32 * 1024)
    })
    child.on("error", () =>
      finish(
        Effect.fail(
          runtimeError("Blocked", "runtime-unavailable", "Runtime could not be launched."),
        ),
      ),
    )
    const settle = (exitCode: number | null) => {
      if (exitCode !== 0) {
        finish(Effect.fail(classifyRuntimeFailure(stderrTail.toString("utf8"), exitCode)))
      } else finish(Effect.succeed({ exitCode: 0, stdout: Buffer.concat(stdout).toString("utf8") }))
    }
    child.on("close", (exitCode) => settle(exitCode))
    if (request.settleOnExitMilliseconds !== undefined) {
      child.on("exit", (exitCode) => {
        setTimeout(() => {
          child.stdout.destroy()
          child.stderr.destroy()
          settle(exitCode)
        }, request.settleOnExitMilliseconds)
      })
    }
    child.stdin.end(request.input)
    return Effect.sync(() => {
      if (!settled) child.kill()
    })
  })
}

export function classifyRuntimeFailure(stderr: string, exitCode: number | null) {
  const diagnostic = stderr.match(/(?:^|\n)ERROR:\s*([\s\S]*)$/u)?.[1] ?? ""
  if (/"code"\s*:\s*"invalid_json_schema"/u.test(diagnostic)) {
    return runtimeError(
      "Blocked",
      "runtime-invalid-json-schema",
      "Runtime rejected the structured-output schema. Every declared property must be required; optional values must be nullable.",
    )
  }
  if (/rate.?limit|too many requests|\b429\b/iu.test(diagnostic)) {
    return runtimeError(
      "Transient",
      "runtime-rate-limited",
      "The provider temporarily rate-limited the subscription runtime.",
    )
  }
  if (/not logged in|unauthori[sz]ed|authentication required|please log in/iu.test(diagnostic)) {
    return runtimeError(
      "Blocked",
      "runtime-not-authenticated",
      "The subscription runtime is not authenticated. Log in through its terminal client.",
    )
  }
  return runtimeError(
    "Blocked",
    "runtime-failed",
    `Runtime exited without a valid result (exit code ${exitCode ?? "unknown"}).`,
  )
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
    "OPENCODE_CONFIG_CONTENT",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "LANG",
  ] as const
  const safe: NodeJS.ProcessEnv = { NODE_ENV: "production" }
  for (const key of allowed) if (environment[key] !== undefined) safe[key] = environment[key]
  return safe
}

function runtimeError(
  classification: RuntimeProcessError["classification"],
  code: string,
  message: string,
) {
  return new RuntimeProcessError({ classification, code, message })
}
/** OpenCode writes to a terminal, so its answer arrives wrapped in colour codes. */
export function withoutTerminalColour(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the escape is the point
  return text.replace(/[[0-9;]*[a-zA-Z]/gu, "")
}

/**
 * A runtime with no output-schema flag prints its banner and its tool trace before answering, and
 * may fence the answer. The object between the outermost braces is the answer in every case.
 */
export function onlyJsonObject(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("the runtime output held no JSON object")
  return text.slice(start, end + 1)
}

/**
 * Why a runtime's answer could not be read, in terms of its shape rather than its content. The
 * output is untrusted and is never persisted, so a failure that says only "malformed" leaves
 * nothing to tell truncation apart from prose the next time it happens.
 */
export function describeUnreadableOutput(stdout: string): string {
  const bytes = Buffer.byteLength(stdout, "utf8")
  if (bytes === 0) return "the runtime wrote nothing"
  const start = stdout.indexOf("{")
  const end = stdout.lastIndexOf("}")
  if (start < 0) return `${bytes} bytes, holding no JSON object`
  if (end <= start) return `${bytes} bytes, holding an object that was never closed`
  return `${bytes} bytes, holding an object that did not parse`
}
