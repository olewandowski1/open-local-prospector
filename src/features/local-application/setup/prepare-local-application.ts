import { spawnSync } from "node:child_process"
import { constants, copyFileSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import type { LocalApplicationConfig } from "@/features/local-application/configuration"
import { migrateLocalDatabase } from "@/features/local-application/infrastructure/database/local-database"
import { canExecuteChromium } from "@/features/local-application/infrastructure/playwright/chromium-readiness"

export type SetupDependencies = Readonly<{
  ensureDirectory(path: string): void
  ensureEnvironmentFile(templatePath: string, destinationPath: string): void
  migrateDatabase(databasePath: string): void
  isChromiumReady(): boolean
  installChromium(): void
}>

export type SetupResult = Readonly<{
  databasePath: string
  artifactsPath: string
  chromium: "verified" | "installed"
}>

export class LocalSetupError extends Error {
  override readonly name = "LocalSetupError"
}

export function prepareLocalApplication(
  config: LocalApplicationConfig,
  dependencies: SetupDependencies = localSetupDependencies,
): SetupResult {
  dependencies.ensureDirectory(dirname(config.databasePath))
  dependencies.ensureDirectory(config.artifactsPath)
  dependencies.ensureEnvironmentFile(config.environmentTemplatePath, config.environmentPath)
  dependencies.migrateDatabase(config.databasePath)

  let chromium: SetupResult["chromium"] = "verified"
  if (!dependencies.isChromiumReady()) {
    try {
      dependencies.installChromium()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new LocalSetupError(
        `Playwright Chromium could not be installed. Check your network and retry "pnpm run setup". ${detail}`,
      )
    }
    chromium = "installed"
  }

  if (!dependencies.isChromiumReady()) {
    throw new LocalSetupError(
      'Playwright Chromium is still unavailable. Run "pnpm exec playwright install chromium" and retry.',
    )
  }

  return { databasePath: config.databasePath, artifactsPath: config.artifactsPath, chromium }
}

function ensureEnvironmentFile(templatePath: string, destinationPath: string): void {
  if (!existsSync(destinationPath)) {
    copyFileSync(templatePath, destinationPath, constants.COPYFILE_EXCL)
  }
}

function isChromiumReady(): boolean {
  return canExecuteChromium()
}

function installChromium(): void {
  const require = createRequire(import.meta.url)
  // Playwright no longer exports the "playwright/cli" subpath, so the package is asked where its executable is.
  const packageManifestPath = require.resolve("playwright/package.json")
  const { bin } = require(packageManifestPath) as { bin: Readonly<Record<string, string>> }
  const cliPath = join(dirname(packageManifestPath), bin.playwright)
  const result = spawnSync(process.execPath, [cliPath, "install", "chromium"], {
    stdio: "inherit",
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Playwright installer exited with code ${result.status ?? "unknown"}.`)
  }
}

export const localSetupDependencies: SetupDependencies = {
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
  ensureEnvironmentFile,
  migrateDatabase: migrateLocalDatabase,
  isChromiumReady,
  installChromium,
}
