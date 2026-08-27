import { Effect, Option } from "effect"

import {
  getRuntimeReadiness,
  parseRuntimeVersion,
  type RuntimeId,
  runtimeDescriptor,
  runtimeIds,
} from "@/features/runtime-settings/application/runtime-readiness"
import {
  getRuntimeUpdateArguments,
  interpretUpdateResult,
  isUpdateAvailable,
  RUNTIME_PACKAGES,
  RUNTIME_UPDATE_TIMEOUT_MILLISECONDS,
  type RuntimeUpdateResult,
  type RuntimeUpdateStatus,
} from "@/features/runtime-settings/application/runtime-update"
import {
  executeRuntimeCommand,
  RuntimeProbeLive,
  resolveRuntimeExecutable,
} from "@/features/runtime-settings/infrastructure/runtime-probe-live"

// Application-owned path and fixed arguments, so nothing external reaches the command line.
export async function updateRuntime(runtimeId: RuntimeId): Promise<RuntimeUpdateResult> {
  const { installInstruction, updateInstruction } = runtimeDescriptor(runtimeId)
  const executable = await Effect.runPromise(resolveRuntimeExecutable(runtimeId))
  if (Option.isNone(executable)) {
    return {
      outcome: "Failed",
      detail: "The runtime executable was not found.",
      terminalInstruction: installInstruction,
    }
  }

  const result = await Effect.runPromise(
    executeRuntimeCommand(
      executable.value,
      getRuntimeUpdateArguments(runtimeId),
      process.env,
      RUNTIME_UPDATE_TIMEOUT_MILLISECONDS,
    ).pipe(
      Effect.map((value) => Option.some(value)),
      Effect.catchAll(() => Effect.succeed(Option.none())),
    ),
  )
  if (Option.isNone(result)) {
    return {
      outcome: "Failed",
      detail: "The update command could not be completed.",
      terminalInstruction: updateInstruction,
    }
  }

  const readiness = await Effect.runPromise(
    getRuntimeReadiness(runtimeId).pipe(Effect.provide(RuntimeProbeLive)),
  )
  const interpreted = interpretUpdateResult(result.value, readiness.version)
  if (interpreted.outcome !== "Failed") return interpreted
  return { ...interpreted, terminalInstruction: updateInstruction }
}

const REGISTRY_TIMEOUT_MILLISECONDS = 8_000

export async function checkRuntimeUpdates(): Promise<readonly RuntimeUpdateStatus[]> {
  const statuses = await Promise.all(runtimeIds.map(checkRuntime))
  return statuses.filter((status): status is RuntimeUpdateStatus => status !== undefined)
}

async function checkRuntime(runtimeId: RuntimeId): Promise<RuntimeUpdateStatus | undefined> {
  const executable = await Effect.runPromise(resolveRuntimeExecutable(runtimeId))
  if (Option.isNone(executable)) return undefined

  const { label, versionArguments } = runtimeDescriptor(runtimeId)
  const [installed, latest] = await Promise.all([
    probeInstalledVersion(executable.value, versionArguments),
    latestPublishedVersion(RUNTIME_PACKAGES[runtimeId]),
  ])

  return {
    runtimeId,
    label,
    checked: installed !== undefined && latest !== undefined,
    updateAvailable: isUpdateAvailable(installed, latest),
    ...(installed ? { installed } : {}),
    ...(latest ? { latest } : {}),
  }
}

async function probeInstalledVersion(
  executable: string,
  versionArguments: readonly string[],
): Promise<string | undefined> {
  const result = await Effect.runPromise(
    executeRuntimeCommand(executable, versionArguments, process.env).pipe(
      Effect.map((value) => Option.some(value)),
      Effect.catchAll(() => Effect.succeed(Option.none())),
    ),
  )
  return Option.isNone(result) ? undefined : parseRuntimeVersion(result.value)
}

// Never cached: a stale answer here would misreport an update.
async function latestPublishedVersion(packageName: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MILLISECONDS),
    })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    if (typeof body !== "object" || body === null) return undefined
    const version = (body as { version?: unknown }).version
    return typeof version === "string" ? version : undefined
  } catch {
    return undefined
  }
}
