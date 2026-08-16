import { Context, Data, Effect, Either } from "effect"

import type { LocalApplicationConfig } from "@/features/local-application/configuration"

export type ReadinessStatus = "Ready" | "Missing" | "Unreachable" | "Unsupported Version"
export type PathState = "present" | "missing" | "unreachable"

export type DatabaseHealth = Readonly<{
  journalMode: string
  foreignKeys: boolean
  busyTimeoutMilliseconds: number
}>

export class ReadinessProbeError extends Data.TaggedError("ReadinessProbeError")<{
  readonly dependency: "sqlite" | "disk" | "playwright"
}> {}

export type DependencyReadiness = Readonly<{
  id: "sqlite" | "brave-search" | "playwright" | "disk"
  label: string
  status: ReadinessStatus
  detail: string
}>

export interface ReadinessProbeService {
  readonly inspectDatabase: (path: string) => Effect.Effect<DatabaseHealth, ReadinessProbeError>
  readonly pathState: (path: string) => Effect.Effect<PathState>
  readonly pathIsWritable: (path: string) => Effect.Effect<boolean>
  readonly availableBytes: (path: string) => Effect.Effect<number, ReadinessProbeError>
  readonly chromiumExecutablePath: Effect.Effect<string, ReadinessProbeError>
  readonly chromiumIsExecutable: (path: string) => Effect.Effect<boolean>
  readonly braveSearchIsConfigured: Effect.Effect<boolean>
}

export class ReadinessProbe extends Context.Tag("LocalApplication/ReadinessProbe")<
  ReadinessProbe,
  ReadinessProbeService
>() {}

export const getLocalReadiness = (config: LocalApplicationConfig) =>
  Effect.gen(function* () {
    const probe = yield* ReadinessProbe
    return yield* Effect.all([
      getDatabaseReadiness(config.databasePath, probe),
      getBraveReadiness(probe),
      getPlaywrightReadiness(probe),
      getDiskReadiness(config.artifactsPath, probe),
    ])
  })

function getDatabaseReadiness(
  databasePath: string,
  probe: ReadinessProbeService,
): Effect.Effect<DependencyReadiness> {
  return Effect.gen(function* () {
    const state = yield* probe.pathState(databasePath)
    if (state === "missing") {
      return dependency(
        "sqlite",
        "SQLite",
        "Missing",
        'Run "pnpm run setup" to create the database.',
      )
    }
    if (state === "unreachable") {
      return dependency(
        "sqlite",
        "SQLite",
        "Unreachable",
        "The configured database path cannot be accessed.",
      )
    }

    const inspected = yield* Effect.either(probe.inspectDatabase(databasePath))
    if (Either.isLeft(inspected)) {
      return dependency(
        "sqlite",
        "SQLite",
        "Unreachable",
        "The configured database could not be opened.",
      )
    }

    const health = inspected.right
    const correctlyConfigured =
      health.journalMode === "wal" && health.foreignKeys && health.busyTimeoutMilliseconds >= 5_000
    return correctlyConfigured
      ? dependency("sqlite", "SQLite", "Ready", "WAL, foreign keys, and busy timeout enabled.")
      : dependency(
          "sqlite",
          "SQLite",
          "Unsupported Version",
          'The database settings are incompatible. Run "pnpm run setup" again.',
        )
  })
}

function getBraveReadiness(probe: ReadinessProbeService): Effect.Effect<DependencyReadiness> {
  return Effect.map(probe.braveSearchIsConfigured, (configured) =>
    configured
      ? dependency("brave-search", "Brave Search", "Ready", "A server-side API key is configured.")
      : dependency(
          "brave-search",
          "Brave Search",
          "Missing",
          "Add BRAVE_SEARCH_API_KEY to .env.local.",
        ),
  )
}

function getPlaywrightReadiness(probe: ReadinessProbeService): Effect.Effect<DependencyReadiness> {
  return Effect.gen(function* () {
    const executable = yield* Effect.either(probe.chromiumExecutablePath)
    if (Either.isLeft(executable)) {
      return dependency(
        "playwright",
        "Playwright Chromium",
        "Unreachable",
        "The compatible browser location could not be determined.",
      )
    }

    const state = yield* probe.pathState(executable.right)
    if (state === "present" && (yield* probe.chromiumIsExecutable(executable.right))) {
      return dependency(
        "playwright",
        "Playwright Chromium",
        "Ready",
        "Compatible browser installed.",
      )
    }
    if (state === "present") {
      return dependency(
        "playwright",
        "Playwright Chromium",
        "Unsupported Version",
        'The installed browser cannot start. Run "pnpm exec playwright install chromium" again.',
      )
    }
    return state === "missing"
      ? dependency(
          "playwright",
          "Playwright Chromium",
          "Missing",
          'Run "pnpm run setup" to install the compatible browser.',
        )
      : dependency(
          "playwright",
          "Playwright Chromium",
          "Unreachable",
          "The compatible browser path cannot be accessed.",
        )
  })
}

const MINIMUM_ARTIFACT_BYTES = 1024 ** 3

function getDiskReadiness(
  artifactsPath: string,
  probe: ReadinessProbeService,
): Effect.Effect<DependencyReadiness> {
  return Effect.gen(function* () {
    const state = yield* probe.pathState(artifactsPath)
    if (state === "missing") {
      return dependency(
        "disk",
        "Artifact storage",
        "Missing",
        'Run "pnpm run setup" to create the artifact directory.',
      )
    }
    if (state === "unreachable" || !(yield* probe.pathIsWritable(artifactsPath))) {
      return dependency(
        "disk",
        "Artifact storage",
        "Unreachable",
        "The artifact directory is not writable or accessible.",
      )
    }

    const capacity = yield* Effect.either(probe.availableBytes(artifactsPath))
    if (Either.isLeft(capacity)) {
      return dependency(
        "disk",
        "Artifact storage",
        "Unreachable",
        "Disk availability could not be determined.",
      )
    }
    if (capacity.right < MINIMUM_ARTIFACT_BYTES) {
      return dependency(
        "disk",
        "Artifact storage",
        "Unreachable",
        `At least 1 GiB is required; ${formatBytes(capacity.right)} is available.`,
      )
    }
    return dependency(
      "disk",
      "Artifact storage",
      "Ready",
      `${formatBytes(capacity.right)} available locally.`,
    )
  })
}

function dependency(
  id: DependencyReadiness["id"],
  label: string,
  status: ReadinessStatus,
  detail: string,
): DependencyReadiness {
  return { id, label, status, detail }
}

function formatBytes(bytes: number): string {
  const gibibytes = bytes / 1024 ** 3
  return `${gibibytes.toFixed(gibibytes >= 10 ? 0 : 1)} GiB`
}
