import { describe, expect, it } from "vitest"

import {
  hasBraveSearchConfiguration,
  loadLocalApplicationConfig,
} from "@/features/local-application/configuration"

describe("local application configuration", () => {
  it("resolves configurable storage paths from the working directory", () => {
    const config = loadLocalApplicationConfig(
      { PROSPECTOR_DATABASE_PATH: "state/test.sqlite", PROSPECTOR_ARTIFACTS_PATH: "files" },
      "C:/workspace",
    )

    expect(config.databasePath.replaceAll("\\", "/")).toBe("C:/workspace/state/test.sqlite")
    expect(config.artifactsPath.replaceAll("\\", "/")).toBe("C:/workspace/files")
  })

  it("only exposes whether a Brave Search key is configured", () => {
    expect(hasBraveSearchConfiguration({ BRAVE_SEARCH_API_KEY: "secret-value" })).toBe(true)
    expect(hasBraveSearchConfiguration({ BRAVE_SEARCH_API_KEY: "   " })).toBe(false)
  })
})
