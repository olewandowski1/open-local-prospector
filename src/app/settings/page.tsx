import { Effect, Option } from "effect"
import { revalidatePath } from "next/cache"
import { connection } from "next/server"

import { AppShell } from "@/components/app-shell/app-shell"
import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { ReadinessProbeLive } from "@/features/local-application/infrastructure/readiness/readiness-probe-live"
import { SettingsPage } from "@/features/local-application/presentation/settings-page"
import { getLocalReadiness } from "@/features/local-application/readiness/get-local-readiness"
import {
  getSelectedRuntime,
  setSelectedRuntime,
} from "@/features/runtime-settings/application/runtime-preference"
import {
  getAllRuntimeReadiness,
  getRuntimeReadiness,
  isRuntimeId,
  type RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"
import { RuntimeSettingsSection } from "@/features/runtime-settings/presentation/runtime-settings-section"

async function selectRuntime(formData: FormData): Promise<void> {
  "use server"

  const value = formData.get("runtimeId")
  if (typeof value !== "string" || !isRuntimeId(value)) return
  const runtime = await Effect.runPromise(
    getRuntimeReadiness(value).pipe(Effect.provide(RuntimeProbeLive)),
  )
  if (runtime.status !== "Ready") return

  const config = loadLocalApplicationConfig()
  await Effect.runPromise(
    setSelectedRuntime(value).pipe(Effect.provide(runtimePreferenceLive(config.databasePath))),
  )
  revalidatePath("/settings")
}

export default async function SettingsRoute() {
  await connection()
  const config = loadLocalApplicationConfig()
  const [readiness, runtimes, selected] = await Promise.all([
    Effect.runPromise(getLocalReadiness(config).pipe(Effect.provide(ReadinessProbeLive))),
    Effect.runPromise(getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive))),
    Effect.runPromise(
      getSelectedRuntime.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<RuntimeId>())),
        Effect.provide(runtimePreferenceLive(config.databasePath)),
      ),
    ),
  ])

  return (
    <AppShell>
      <SettingsPage readiness={readiness}>
        <RuntimeSettingsSection
          runtimes={runtimes}
          selectedRuntime={Option.getOrUndefined(selected)}
          selectRuntime={selectRuntime}
        />
      </SettingsPage>
    </AppShell>
  )
}
