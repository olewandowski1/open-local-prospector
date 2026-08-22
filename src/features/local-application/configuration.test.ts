import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"

/**
 * An absolute directory for whichever platform is running the tests: `C:\workspace` on Windows and
 * `/workspace` elsewhere. Writing the Windows form literally made this suite pass only on Windows —
 * on Linux `C:/workspace` is a relative path, so every resolved path grew the real working
 * directory in front of it and the assertions failed.
 */
const workingDirectory = resolve("/workspace")

describe("local application configuration", () => {
  it("resolves configurable storage paths from the working directory", () => {
    const config = loadLocalApplicationConfig(
      { PROSPECTOR_DATABASE_PATH: "state/test.sqlite", PROSPECTOR_ARTIFACTS_PATH: "files" },
      workingDirectory,
    )

    expect(config.databasePath).toBe(join(workingDirectory, "state", "test.sqlite"))
    expect(config.artifactsPath).toBe(join(workingDirectory, "files"))
  })

  it("keeps an absolute override where the operator put it", () => {
    const elsewhere = resolve("/mnt/prospector")
    const config = loadLocalApplicationConfig(
      {
        PROSPECTOR_DATABASE_PATH: join(elsewhere, "prospector.sqlite"),
        PROSPECTOR_ARTIFACTS_PATH: join(elsewhere, "artifacts"),
      },
      workingDirectory,
    )

    expect(config.databasePath).toBe(join(elsewhere, "prospector.sqlite"))
    expect(config.artifactsPath).toBe(join(elsewhere, "artifacts"))
  })

  it("falls back to the ignored .local workspace", () => {
    const config = loadLocalApplicationConfig({}, workingDirectory)

    expect(config.databasePath).toBe(
      join(workingDirectory, ".local", "open-local-prospector.sqlite"),
    )
    expect(config.artifactsPath).toBe(join(workingDirectory, ".local", "artifacts"))
    expect(config.environmentPath).toBe(join(workingDirectory, ".env.local"))
    expect(config.environmentTemplatePath).toBe(join(workingDirectory, ".env.local.example"))
  })
})
