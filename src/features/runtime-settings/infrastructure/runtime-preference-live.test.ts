import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Effect, Option } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import { loadLocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import {
  getSelectedRuntime,
  setSelectedRuntime,
} from "@/features/runtime-settings/application/runtime-preference"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("runtime preference persistence", () => {
  it("restores the selected runtime from SQLite", async () => {
    const directory = mkdtempSync(join(tmpdir(), "runtime-preference-"))
    temporaryDirectories.push(directory)
    const config = loadLocalApplicationConfig(
      { PROSPECTOR_DATABASE_PATH: join(directory, "prospector.sqlite") },
      directory,
    )
    migrateLocalDatabase(config.databasePath)
    const layer = runtimePreferenceLive(config.databasePath)

    await Effect.runPromise(setSelectedRuntime("claude").pipe(Effect.provide(layer)))
    const restored = await Effect.runPromise(getSelectedRuntime.pipe(Effect.provide(layer)))

    expect(Option.getOrUndefined(restored)).toBe("claude")
  })
})
