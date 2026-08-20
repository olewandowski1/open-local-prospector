import { NextResponse } from "next/server"
import { createConfirmedProspectingRun } from "@/features/prospecting-runs/server/search-brief-services"
import { withWorkspaceAdmission } from "@/features/workspace-administration"

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!isConfirmation(body)) throw new Error("invalid confirmation")
    const run = await withWorkspaceAdmission(() =>
      createConfirmedProspectingRun(body.draft, body.searchAreaId, body.requestId),
    )
    return NextResponse.json({ id: run.id, state: run.state }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("maintenance")) {
      return NextResponse.json(
        { error: "Workspace maintenance is in progress. Try again when it finishes." },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: "The run was not created. Repeat preflight and confirm a ready Search Brief." },
      { status: 400 },
    )
  }
}

function isConfirmation(
  value: unknown,
): value is { draft: unknown; searchAreaId: string; requestId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    "searchAreaId" in value &&
    typeof value.searchAreaId === "string" &&
    "requestId" in value &&
    typeof value.requestId === "string"
  )
}
