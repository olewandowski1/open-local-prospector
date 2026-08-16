import { constants } from "node:fs"
import { access, stat, statfs } from "node:fs/promises"

import { chromium } from "playwright"

import {
  hasBraveSearchConfiguration,
  type LocalApplicationConfig,
} from "@/features/local-application/configuration"
import {
  type DatabaseHealth,
  inspectLocalDatabase,
} from "@/features/local-application/infrastructure/database/local-database"

export type ReadinessStatus = "Ready" | "Missing" | "Unreachable" | "Unsupported Version"

export type DependencyReadiness = Readonly<{
  id: "sqlite" | "brave-search" | "playwright" | "disk"
  label: string
  status: ReadinessStatus
  detail: string
}>

export type ReadinessDependencies = Readonly<{
  inspectDatabase(path: string): DatabaseHealth
  pathExists(path: string): Promise<boolean>
  pathIsWritable(path: string): Promise<boolean>
  availableBytes(path: string): Promise<number>
  chromiumExecutablePath(): string
  braveSearchIsConfigured(): boolean
}>

export async function getLocalReadiness(
  config: LocalApplicationConfig,
  dependencies: ReadinessDependencies = localReadinessDependencies,
): Promise<readonly DependencyReadiness[]> {
  return Promise.all([
    getDatabaseReadiness(config.databasePath, dependencies),
    getBraveReadiness(dependencies),
    getPlaywrightReadiness(dependencies),
    getDiskReadiness(config.artifactsPath, dependencies),
  ])
}

async function getDatabaseReadiness(
  databasePath: string,
  dependencies: ReadinessDependencies,
): Promise<DependencyReadiness> {
  if (!(await dependencies.pathExists(databasePath))) {
    return dependency("sqlite", "SQLite", "Missing", 'Run "pnpm run setup" to create the database.')
  }

  try {
    const health = dependencies.inspectDatabase(databasePath)
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
  } catch {
    return dependency(
      "sqlite",
      "SQLite",
      "Unreachable",
      "The configured database could not be opened.",
    )
  }
}

function getBraveReadiness(dependencies: ReadinessDependencies): DependencyReadiness {
  return dependencies.braveSearchIsConfigured()
    ? dependency("brave-search", "Brave Search", "Ready", "A server-side API key is configured.")
    : dependency(
        "brave-search",
        "Brave Search",
        "Missing",
        "Add BRAVE_SEARCH_API_KEY to .env.local.",
      )
}

async function getPlaywrightReadiness(
  dependencies: ReadinessDependencies,
): Promise<DependencyReadiness> {
  const executablePath = dependencies.chromiumExecutablePath()
  return (await dependencies.pathExists(executablePath))
    ? dependency("playwright", "Playwright Chromium", "Ready", "Compatible browser installed.")
    : dependency(
        "playwright",
        "Playwright Chromium",
        "Missing",
        'Run "pnpm run setup" to install the compatible browser.',
      )
}

async function getDiskReadiness(
  artifactsPath: string,
  dependencies: ReadinessDependencies,
): Promise<DependencyReadiness> {
  if (!(await dependencies.pathExists(artifactsPath))) {
    return dependency(
      "disk",
      "Artifact storage",
      "Missing",
      'Run "pnpm run setup" to create the artifact directory.',
    )
  }

  try {
    if (!(await dependencies.pathIsWritable(artifactsPath))) {
      return dependency(
        "disk",
        "Artifact storage",
        "Unreachable",
        "The artifact directory is not writable.",
      )
    }
    const availableBytes = await dependencies.availableBytes(artifactsPath)
    return dependency(
      "disk",
      "Artifact storage",
      "Ready",
      `${formatBytes(availableBytes)} available locally.`,
    )
  } catch {
    return dependency(
      "disk",
      "Artifact storage",
      "Unreachable",
      "Disk availability could not be determined.",
    )
  }
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

const localReadinessDependencies: ReadinessDependencies = {
  inspectDatabase: inspectLocalDatabase,
  pathExists: async (path) =>
    stat(path)
      .then(() => true)
      .catch(() => false),
  pathIsWritable: async (path) =>
    access(path, constants.W_OK)
      .then(() => true)
      .catch(() => false),
  availableBytes: async (path) => {
    const storage = await statfs(path)
    return Number(storage.bavail) * Number(storage.bsize)
  },
  chromiumExecutablePath: () => chromium.executablePath(),
  braveSearchIsConfigured: () => hasBraveSearchConfiguration(),
}
