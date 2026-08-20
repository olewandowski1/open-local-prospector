import {
  assertSameOrigin,
  resetLocalWorkspace,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body: unknown = await request.json()
    if (!isResetConfirmation(body)) throw new Error("Type RESET to confirm.")
    return Response.json(resetLocalWorkspace())
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}

function isResetConfirmation(value: unknown): value is { confirmation: "RESET" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "confirmation" in value &&
    value.confirmation === "RESET"
  )
}
