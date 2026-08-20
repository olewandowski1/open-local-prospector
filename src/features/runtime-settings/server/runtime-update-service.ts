import { Effect, Option } from "effect"

import {
  getRuntimeReadiness,
  parseRuntimeVersion,
  type RuntimeId,
  runtimeDescriptor,
  runtimeIds,
} from "@/features/runtime-settings/application/runtime-readiness"
import {
  interpretUpdateResult,
  isUpdateAvailable,
  RUNTIME_PACKAGES,
  RUNTIME_UPDATE_ARGUMENTS,
  RUNTIME_UPDATE_TIMEOUT_MILLISECONDS,
  type RuntimeUpdateResult,
  type RuntimeUpdateStatus,
} from "@/features/runtime-settings/application/runtime-update"
import {
  executeRuntimeCommand,
  RuntimeProbeLive,
  resolveRuntimeExecutable,
} from "@/features/runtime-settings/infrastructure/runtime-probe-live"

/**
 * Runs a provider CLI's own update command. The executable is resolved from the application-owned
 * candidate paths and the arguments are fixed, so nothing a user or a source can influence reaches
 * the command line.
 */
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
      RUNTIME_UPDATE_ARGUMENTS,
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
  // A CLI can exit non-zero because it could not work out how it was installed, which is recoverable
  // by hand; the manual command is offered alongside whatever the CLI reported.
  if (interpreted.outcome !== "Failed") return interpreted
  return { ...interpreted, terminalInstruction: updateInstruction }
}

const REGISTRY_TIMEOUT_MILLISECONDS = 8_000

/**
 * Compares each installed CLI against the version published to npm. Neither CLI can be asked whether
 * an update exists without installing one, so the registry is read directly; when either side cannot
 * be read the runtime is reported as unchecked rather than assumed current or stale.
 */
export async function checkRuntimeUpdates(): Promise<readonly RuntimeUpdateStatus[]> {
  const statuses = await Promise.all(runtimeIds.map(checkRuntime))
  return statuses.filter((status): status is RuntimeUpdateStatus => status !== undefined)
}

async function checkRuntime(runtimeId: RuntimeId): Promise<RuntimeUpdateStatus | undefined> {
  const executable = await Effect.runPromise(resolveRuntimeExecutable(runtimeId))
  // A runtime that is not installed has nothing to update; it is left out rather than shown as stale.
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

/** Read-only, unauthenticated, and never cached — a stale answer here would misreport an update. */
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
