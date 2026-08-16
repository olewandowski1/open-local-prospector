import { constants } from "node:fs"
import { access, stat, statfs } from "node:fs/promises"

import { Effect, Layer } from "effect"

import { hasBraveSearchConfiguration } from "@/features/local-application/configuration"
import { inspectLocalDatabase } from "@/features/local-application/infrastructure/database/local-database"
import {
  canExecuteChromium,
  getChromiumExecutablePath,
} from "@/features/local-application/infrastructure/playwright/chromium-readiness"
import {
  type PathState,
  ReadinessProbe,
  ReadinessProbeError,
} from "@/features/local-application/readiness/get-local-readiness"

function getPathState(path: string): Effect.Effect<PathState> {
  return Effect.tryPromise({
    try: () => stat(path),
    catch: (error) => error,
  }).pipe(
    Effect.match({
      onFailure: (error) =>
        isNodeError(error) && error.code === "ENOENT" ? "missing" : "unreachable",
      onSuccess: () => "present",
    }),
  )
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

export const ReadinessProbeLive = Layer.succeed(ReadinessProbe, {
  inspectDatabase: (path) =>
    Effect.try({
      try: () => inspectLocalDatabase(path),
      catch: () => new ReadinessProbeError({ dependency: "sqlite" }),
    }),
  pathState: getPathState,
  pathIsWritable: (path) =>
    Effect.promise(async () => {
      try {
        await access(path, constants.W_OK)
        return true
      } catch {
        return false
      }
    }),
  availableBytes: (path) =>
    Effect.tryPromise({
      try: async () => {
        const storage = await statfs(path)
        return Number(storage.bavail) * Number(storage.bsize)
      },
      catch: () => new ReadinessProbeError({ dependency: "disk" }),
    }),
  chromiumExecutablePath: Effect.try({
    try: getChromiumExecutablePath,
    catch: () => new ReadinessProbeError({ dependency: "playwright" }),
  }),
  chromiumIsExecutable: (path) => Effect.sync(() => canExecuteChromium(path)),
  braveSearchIsConfigured: Effect.sync(() => hasBraveSearchConfiguration()),
})
