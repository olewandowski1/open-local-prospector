import { NextResponse } from "next/server"

import { getPersistedRun } from "@/features/run-monitoring/server/run-services"
import {
  assertSameOrigin,
  deleteProspectingRun,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    return NextResponse.json(await getPersistedRun(runId))
  } catch {
    return NextResponse.json({ error: "Prospecting Run not found." }, { status: 404 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    assertSameOrigin(request)
    if (request.headers.get("x-workspace-confirmation") !== "DELETE") {
      throw new Error("Type DELETE to confirm deleting this run.")
    }
    const { runId } = await context.params
    return Response.json(deleteProspectingRun(runId))
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
