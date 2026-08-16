import { describe, expect, it } from "vitest"

import type { LocalApplicationConfig } from "@/features/local-application/configuration"
import {
  getLocalReadiness,
  type ReadinessDependencies,
} from "@/features/local-application/readiness/get-local-readiness"

const config: LocalApplicationConfig = {
  databasePath: "/workspace/.local/prospector.sqlite",
  artifactsPath: "/workspace/.local/artifacts",
  environmentPath: "/workspace/.env.local",
  environmentTemplatePath: "/workspace/.env.local.example",
}

function createDependencies(overrides: Partial<ReadinessDependencies> = {}): ReadinessDependencies {
  return {
    inspectDatabase: () => ({
      journalMode: "wal",
      foreignKeys: true,
      busyTimeoutMilliseconds: 5_000,
    }),
    pathExists: async () => true,
    pathIsWritable: async () => true,
    availableBytes: async () => 20 * 1024 ** 3,
    chromiumExecutablePath: () => "/browsers/chromium",
    braveSearchIsConfigured: () => true,
    ...overrides,
  }
}

describe("getLocalReadiness", () => {
  it("reports all local dependencies as ready without exposing a secret", async () => {
    const readiness = await getLocalReadiness(config, createDependencies())

    expect(readiness.map(({ status }) => status)).toEqual(["Ready", "Ready", "Ready", "Ready"])
    expect(JSON.stringify(readiness)).not.toContain("secret-value")
  })

  it("reports missing setup dependencies with actionable instructions", async () => {
    const readiness = await getLocalReadiness(
      config,
      createDependencies({
        pathExists: async () => false,
        braveSearchIsConfigured: () => false,
      }),
    )

    expect(readiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "sqlite", status: "Missing" }),
        expect.objectContaining({ id: "brave-search", status: "Missing" }),
        expect.objectContaining({ id: "playwright", status: "Missing" }),
        expect.objectContaining({ id: "disk", status: "Missing" }),
      ]),
    )
  })

  it("reports an inaccessible dependency without leaking the underlying error", async () => {
    const readiness = await getLocalReadiness(
      config,
      createDependencies({
        inspectDatabase: () => {
          throw new Error("secret-value")
        },
      }),
    )

    expect(readiness[0]).toMatchObject({ id: "sqlite", status: "Unreachable" })
    expect(JSON.stringify(readiness)).not.toContain("secret-value")
  })
})
