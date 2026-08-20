import {
  assertSameOrigin,
  cleanupLocalArtifacts,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = (await request.json()) as { confirmation?: unknown }
    if (body.confirmation !== "CLEANUP")
      throw new Error("Type CLEANUP to confirm artifact cleanup.")
    return Response.json(cleanupLocalArtifacts())
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
