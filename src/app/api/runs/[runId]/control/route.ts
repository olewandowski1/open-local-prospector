import { NextResponse } from "next/server"

import type { RunControl } from "@/features/run-monitoring/application/run-repositories"
import { requestRunControl } from "@/features/run-monitoring/server/run-services"
import { assertSameOrigin } from "@/features/workspace-administration"

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    assertSameOrigin(request)
    const body: unknown = await request.json()
    if (!isControlRequest(body)) throw new Error("invalid control")
    const { runId } = await context.params
    await requestRunControl(runId, body.control, body.runtime)
    return NextResponse.json({ accepted: true })
  } catch {
    return NextResponse.json({ error: "The run control was not accepted." }, { status: 400 })
  }
}

function isControlRequest(
  value: unknown,
): value is { control: RunControl; runtime?: "codex" | "claude" | "opencode" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "control" in value &&
    (value.control === "Pause" || value.control === "Resume" || value.control === "Cancel") &&
    (!("runtime" in value) ||
      value.runtime === "codex" ||
      value.runtime === "claude" ||
      value.runtime === "opencode")
  )
}
