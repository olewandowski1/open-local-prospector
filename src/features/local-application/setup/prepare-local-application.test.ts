import { describe, expect, it, vi } from "vitest"

import type { LocalApplicationConfig } from "@/features/local-application/configuration"
import {
  LocalSetupError,
  prepareLocalApplication,
  type SetupDependencies,
} from "@/features/local-application/setup/prepare-local-application"

const config: LocalApplicationConfig = {
  databasePath: "C:/workspace/.local/prospector.sqlite",
  artifactsPath: "C:/workspace/.local/artifacts",
  environmentPath: "C:/workspace/.env.local",
  environmentTemplatePath: "C:/workspace/.env.local.example",
}

function createDependencies(chromiumStates: boolean[]): SetupDependencies {
  return {
    ensureDirectory: vi.fn(),
    ensureEnvironmentFile: vi.fn(),
    migrateDatabase: vi.fn(),
    isChromiumReady: vi.fn(() => chromiumStates.shift() ?? true),
    installChromium: vi.fn(),
  }
}

describe("prepareLocalApplication", () => {
  it("prepares storage, configuration, database, and an already installed browser", () => {
    const dependencies = createDependencies([true, true])

    expect(prepareLocalApplication(config, dependencies)).toEqual({
      databasePath: config.databasePath,
      artifactsPath: config.artifactsPath,
      chromium: "verified",
    })
    expect(dependencies.ensureDirectory).toHaveBeenCalledTimes(2)
    expect(dependencies.ensureEnvironmentFile).toHaveBeenCalledWith(
      config.environmentTemplatePath,
      config.environmentPath,
    )
    expect(dependencies.migrateDatabase).toHaveBeenCalledWith(config.databasePath)
    expect(dependencies.installChromium).not.toHaveBeenCalled()
  })

  it("can be repeated without changing the setup contract", () => {
    const dependencies = createDependencies([true, true])

    prepareLocalApplication(config, dependencies)
    prepareLocalApplication(config, dependencies)

    expect(dependencies.ensureEnvironmentFile).toHaveBeenCalledTimes(2)
    expect(dependencies.migrateDatabase).toHaveBeenCalledTimes(2)
  })

  it("installs Chromium when the compatible browser is missing", () => {
    const dependencies = createDependencies([false, true])

    expect(prepareLocalApplication(config, dependencies).chromium).toBe("installed")
    expect(dependencies.installChromium).toHaveBeenCalledOnce()
  })

  it("reports an actionable failure when Chromium remains unavailable", () => {
    const dependencies = createDependencies([false, false])

    expect(() => prepareLocalApplication(config, dependencies)).toThrowError(LocalSetupError)
    expect(() => prepareLocalApplication(config, createDependencies([false, false]))).toThrow(
      "pnpm exec playwright install chromium",
    )
  })
})
