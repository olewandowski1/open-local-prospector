import { Effect, Option } from "effect"

import {
  getRuntimeReadiness,
  type RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"
import {
  interpretUpdateResult,
  RUNTIME_UPDATE_ARGUMENTS,
  RUNTIME_UPDATE_TIMEOUT_MILLISECONDS,
  type RuntimeUpdateResult,
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
  const executable = await Effect.runPromise(resolveRuntimeExecutable(runtimeId))
  if (Option.isNone(executable)) {
    return { outcome: "Failed", detail: "The runtime executable was not found." }
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
    return { outcome: "Failed", detail: "The update command could not be completed." }
  }

  const readiness = await Effect.runPromise(
    getRuntimeReadiness(runtimeId).pipe(Effect.provide(RuntimeProbeLive)),
  )
  return interpretUpdateResult(result.value, readiness.version)
}
