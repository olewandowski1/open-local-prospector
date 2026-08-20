import {
  assertSameOrigin,
  removeSuppression,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ identityFingerprint: string }> },
) {
  try {
    assertSameOrigin(request)
    const { identityFingerprint } = await context.params
    if (!identityFingerprint || identityFingerprint.length > 500) {
      throw new Error("The suppression identifier is invalid.")
    }
    if (!removeSuppression(identityFingerprint)) throw new Error("Suppression not found.")
    return new Response(null, { status: 204 })
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
