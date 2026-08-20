import { Effect, Option } from "effect"
import { revalidatePath } from "next/cache"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
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
import { RuntimeReadinessSkeleton } from "@/features/runtime-settings/presentation/runtime-readiness-skeleton"
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
  revalidatePath("/settings/subscription")
}

/** Probes every provider CLI, so it is streamed in rather than blocking the section list. */
async function RuntimeReadinessCards() {
  const config = loadLocalApplicationConfig()
  const [runtimes, selected] = await Promise.all([
    Effect.runPromise(getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive))),
    Effect.runPromise(
      getSelectedRuntime.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<RuntimeId>())),
        Effect.provide(runtimePreferenceLive(config.databasePath)),
      ),
    ),
  ])

  return (
    <RuntimeSettingsSection
      runtimes={runtimes}
      selectedRuntime={Option.getOrUndefined(selected)}
      selectRuntime={selectRuntime}
    />
  )
}

export default async function SubscriptionSettingsRoute() {
  await connection()

  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section aria-labelledby="subscription-runtimes-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="subscription-runtimes-heading" className="font-heading text-lg font-semibold">
            Subscription Runtimes
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Login stays in each provider&apos;s own terminal. The application stores only which
            runtime you selected, never a credential.
          </p>
        </div>

        <Suspense fallback={<RuntimeReadinessSkeleton />}>
          <RuntimeReadinessCards />
        </Suspense>
      </section>
    </div>
  )
}
