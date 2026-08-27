import { type ChildProcess, spawn, spawnSync } from "node:child_process"

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
  /** Settle after exit when a helper process keeps inherited output pipes open. */
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
      // A process group lets interruption terminate descendants; Windows uses taskkill tree mode.
      detached: process.platform !== "win32",
      env: buildSafeRuntimeEnvironment({ ...process.env, ...request.environment }),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const timer = setTimeout(() => {
      terminateRuntimeProcessTree(child)
      finish(Effect.fail(runtimeError("Transient", "runtime-timeout", "Runtime timed out.")))
    }, timeout)
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength
      if (outputBytes > outputLimit) {
        terminateRuntimeProcessTree(child)
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
      if (!settled) terminateRuntimeProcessTree(child)
    })
  })
}

export function terminateRuntimeProcessTree(child: ChildProcess): void {
  const pid = child.pid
  if (pid === undefined) {
    child.kill("SIGKILL")
    return
  }
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5_000,
    })
    if (result.status === 0) return
  } else {
    try {
      process.kill(-pid, "SIGKILL")
      return
    } catch {
      // The process may have exited between the bound firing and group termination.
    }
  }
  child.kill("SIGKILL")
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

export function buildSafeRuntimeEnvironment(
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

/** Extract JSON from runtimes that wrap the answer in banners, traces, or fences. */
export function onlyJsonObject(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("the runtime output held no JSON object")
  return text.slice(start, end + 1)
}

/** Describe untrusted output by shape without persisting its content. */
export function describeUnreadableOutput(stdout: string): string {
  const bytes = Buffer.byteLength(stdout, "utf8")
  if (bytes === 0) return "the runtime wrote nothing"
  const start = stdout.indexOf("{")
  const end = stdout.lastIndexOf("}")
  if (start < 0) return `${bytes} bytes, holding no JSON object`
  if (end <= start) return `${bytes} bytes, holding an object that was never closed`
  return `${bytes} bytes, holding an object that did not parse`
}
