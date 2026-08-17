import { Effect } from "effect"
import { NextResponse } from "next/server"

import { getAllRuntimeReadiness } from "@/features/runtime-settings/application/runtime-readiness"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"

/** Readiness only ever reports status and version; no provider credential is read or returned. */
export async function GET() {
  const runtimes = await Effect.runPromise(
    getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive)),
  )
  return NextResponse.json({ runtimes })
}
