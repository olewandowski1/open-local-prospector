import { spawn } from "node:child_process"
import { constants } from "node:fs"
import { access } from "node:fs/promises"
import { isAbsolute, join, delimiter as pathDelimiter } from "node:path"

import { Effect, Layer, Option } from "effect"

import {
  RuntimeCommandError,
  type RuntimeCommandResult,
  type RuntimeId,
  RuntimeProbe,
} from "@/features/runtime-settings/application/runtime-readiness"

const COMMAND_TIMEOUT_MILLISECONDS = 5_000
const COMMAND_OUTPUT_LIMIT_BYTES = 64 * 1024

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>

export function executeRuntimeCommand(
  executable: string,
  arguments_: readonly string[],
  environment: RuntimeEnvironment = process.env,
  timeoutMilliseconds = COMMAND_TIMEOUT_MILLISECONDS,
): Effect.Effect<RuntimeCommandResult, RuntimeCommandError> {
  return Effect.async<RuntimeCommandResult, RuntimeCommandError>((resume) => {
    const child = spawn(executable, arguments_, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: safeRuntimeEnvironment(environment),
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let outputBytes = 0
    let settled = false

    const finish = (effect: Effect.Effect<RuntimeCommandResult, RuntimeCommandError>): void => {
      if (settled) return
      settled = true
      resume(effect)
    }

    const collect = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.byteLength
      if (outputBytes > COMMAND_OUTPUT_LIMIT_BYTES) {
        child.kill()
        finish(Effect.fail(new RuntimeCommandError({ reason: "output-limit" })))
        return
      }
      target.push(chunk)
    }

    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk))
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk))
    child.on("error", () => finish(Effect.fail(new RuntimeCommandError({ reason: "spawn" }))))
    child.on("close", (exitCode) =>
      finish(
        Effect.succeed({
          exitCode: exitCode ?? -1,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        }),
      ),
    )

    return Effect.sync(() => {
      if (!settled) child.kill()
    })
  }).pipe(
    Effect.timeoutFail({
      duration: timeoutMilliseconds,
      onTimeout: () => new RuntimeCommandError({ reason: "timeout" }),
    }),
  )
}

export function resolveRuntimeExecutable(
  runtimeId: RuntimeId,
  environment: RuntimeEnvironment = process.env,
  platform = process.platform,
  architecture = process.arch,
): Effect.Effect<Option.Option<string>> {
  return Effect.promise(async () => {
    for (const candidate of executableCandidates(runtimeId, environment, platform, architecture)) {
      try {
        await access(candidate, constants.X_OK)
        return Option.some(candidate)
      } catch {
        // Continue through application-owned candidate paths.
      }
    }
    return Option.none()
  })
}

function executableCandidates(
  runtimeId: RuntimeId,
  environment: RuntimeEnvironment,
  platform: NodeJS.Platform,
  architecture: string,
): readonly string[] {
  const executableName = platform === "win32" ? `${runtimeId}.exe` : runtimeId
  const overrideKey = `PROSPECTOR_${runtimeId.toUpperCase()}_EXECUTABLE`
  const configured = environment[overrideKey]
  const candidates = configured && isAbsolute(configured) ? [configured] : []

  for (const directory of (environment.PATH ?? "").split(pathDelimiter).filter(Boolean)) {
    candidates.push(join(directory, executableName))
  }

  const userDirectory = environment.USERPROFILE ?? environment.HOME
  if (userDirectory) {
    candidates.push(join(userDirectory, ".local", "bin", executableName))
    if (runtimeId === "opencode") {
      candidates.push(join(userDirectory, ".opencode", "bin", executableName))
    }
  }

  if (runtimeId === "codex" && platform === "win32" && environment.APPDATA) {
    const packageArchitecture = architecture === "arm64" ? "arm64" : "x64"
    const targetArchitecture = architecture === "arm64" ? "aarch64" : "x86_64"
    candidates.push(
      join(
        environment.APPDATA,
        "npm",
        "node_modules",
        "@openai",
        "codex",
        "node_modules",
        "@openai",
        `codex-win32-${packageArchitecture}`,
        "vendor",
        `${targetArchitecture}-pc-windows-msvc`,
        "bin",
        "codex.exe",
      ),
    )
  }

  return [...new Set(candidates)]
}

function safeRuntimeEnvironment(environment: RuntimeEnvironment): NodeJS.ProcessEnv {
  const allowedKeys = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "LANG",
  ] as const
  const safe: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV }
  for (const key of allowedKeys) {
    if (environment[key] !== undefined) safe[key] = environment[key]
  }
  return safe
}

export const RuntimeProbeLive = Layer.succeed(RuntimeProbe, {
  resolveExecutable: (runtimeId) => resolveRuntimeExecutable(runtimeId),
  execute: (executable, arguments_) => executeRuntimeCommand(executable, arguments_),
})
