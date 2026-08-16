import { NextResponse } from "next/server"

import { getPersistedRun } from "@/features/run-monitoring/server/run-services"

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    return NextResponse.json(await getPersistedRun(runId))
  } catch {
    return NextResponse.json({ error: "Prospecting Run not found." }, { status: 404 })
  }
}
