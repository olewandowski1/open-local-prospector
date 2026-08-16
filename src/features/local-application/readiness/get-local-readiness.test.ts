import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"

import type { LocalApplicationConfig } from "@/features/local-application/configuration"
import {
  getLocalReadiness,
  ReadinessProbe,
  type ReadinessProbeService,
} from "@/features/local-application/readiness/get-local-readiness"

const config: LocalApplicationConfig = {
  databasePath: "/workspace/.local/prospector.sqlite",
  artifactsPath: "/workspace/.local/artifacts",
  environmentPath: "/workspace/.env.local",
  environmentTemplatePath: "/workspace/.env.local.example",
}

function createProbe(overrides: Partial<ReadinessProbeService> = {}): ReadinessProbeService {
  return {
    inspectDatabase: () =>
      Effect.succeed({ journalMode: "wal", foreignKeys: true, busyTimeoutMilliseconds: 5_000 }),
    pathState: () => Effect.succeed("present"),
    pathIsWritable: () => Effect.succeed(true),
    availableBytes: () => Effect.succeed(20 * 1024 ** 3),
    chromiumExecutablePath: Effect.succeed("/browsers/chromium"),
    braveSearchIsConfigured: Effect.succeed(true),
    ...overrides,
  }
}

function runReadiness(probe: ReadinessProbeService) {
  return Effect.runPromise(
    getLocalReadiness(config).pipe(Effect.provide(Layer.succeed(ReadinessProbe, probe))),
  )
}

describe("getLocalReadiness", () => {
  it("reports all local dependencies as ready without exposing a secret", async () => {
    const readiness = await runReadiness(createProbe())

    expect(readiness.map(({ status }) => status)).toEqual(["Ready", "Ready", "Ready", "Ready"])
    expect(JSON.stringify(readiness)).not.toContain("secret-value")
  })

  it("reports missing setup dependencies with actionable instructions", async () => {
    const readiness = await runReadiness(
      createProbe({
        pathState: () => Effect.succeed("missing"),
        braveSearchIsConfigured: Effect.succeed(false),
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

  it("distinguishes an inaccessible path from a missing path", async () => {
    const readiness = await runReadiness(
      createProbe({ pathState: () => Effect.succeed("unreachable") }),
    )

    expect(readiness[0]).toMatchObject({ id: "sqlite", status: "Unreachable" })
    expect(readiness[2]).toMatchObject({ id: "playwright", status: "Unreachable" })
    expect(readiness[3]).toMatchObject({ id: "disk", status: "Unreachable" })
  })

  it("does not expose an underlying dependency error", async () => {
    const readiness = await runReadiness(
      createProbe({ inspectDatabase: () => Effect.fail(new Error("secret-value")) }),
    )

    expect(readiness[0]).toMatchObject({ id: "sqlite", status: "Unreachable" })
    expect(JSON.stringify(readiness)).not.toContain("secret-value")
  })

  it("requires enough disk capacity for inspection artifacts", async () => {
    const readiness = await runReadiness(
      createProbe({ availableBytes: () => Effect.succeed(512 * 1024 ** 2) }),
    )

    expect(readiness[3]).toMatchObject({ id: "disk", status: "Unreachable" })
    expect(readiness[3]?.detail).toContain("At least 1 GiB")
  })
})
