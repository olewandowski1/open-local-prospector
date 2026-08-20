import {
  assertSameOrigin,
  compactLocalWorkspace,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    return Response.json(compactLocalWorkspace())
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
