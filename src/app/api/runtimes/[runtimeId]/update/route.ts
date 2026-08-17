import { NextResponse } from "next/server"

import { isRuntimeId } from "@/features/runtime-settings/application/runtime-readiness"
import { updateRuntime } from "@/features/runtime-settings/server/runtime-update-service"

export async function POST(_request: Request, context: { params: Promise<{ runtimeId: string }> }) {
  const { runtimeId } = await context.params
  if (!isRuntimeId(runtimeId)) {
    return NextResponse.json({ error: "Unknown runtime." }, { status: 404 })
  }

  const result = await updateRuntime(runtimeId)
  return NextResponse.json(result, { status: result.outcome === "Failed" ? 502 : 200 })
}
