import {
  assertSameOrigin,
  deleteLocalBusiness,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ scoreId: string }> },
) {
  try {
    assertSameOrigin(request)
    if (request.headers.get("x-workspace-confirmation") !== "DELETE") {
      throw new Error("Type DELETE to confirm deleting this business.")
    }
    const { scoreId } = await params
    return Response.json(deleteLocalBusiness(scoreId))
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
