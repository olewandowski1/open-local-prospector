import {
  getRunDeletionPreview,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    return Response.json(getRunDeletionPreview(runId), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
