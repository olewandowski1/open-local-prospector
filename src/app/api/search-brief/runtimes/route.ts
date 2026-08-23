import { Effect } from "effect"
import { NextResponse } from "next/server"

import { getAllRuntimeReadiness } from "@/features/runtime-settings/application/runtime-readiness"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"

// Kept separate from brief defaults because each runtime invokes bounded CLI readiness checks.
export async function GET() {
  const runtimes = await Effect.runPromise(
    getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive)),
  )
  return NextResponse.json({ runtimes })
}
