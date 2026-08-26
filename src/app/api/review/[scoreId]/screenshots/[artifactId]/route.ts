import { loadLocalApplicationConfig } from "@/features/local-application"
import { readCandidateScreenshot } from "@/features/review-queue/server/candidate-screenshot"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/review/[scoreId]/screenshots/[artifactId]">,
) {
  try {
    const { scoreId, artifactId } = await context.params
    const config = loadLocalApplicationConfig()
    const screenshot = await readCandidateScreenshot(
      config.databasePath,
      config.artifactsPath,
      scoreId,
      artifactId,
    )
    if (!screenshot) return Response.json({ error: "Screenshot not found." }, { status: 404 })
    return new Response(new Uint8Array(screenshot.body).buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": screenshot.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return Response.json({ error: "Screenshot could not be read." }, { status: 500 })
  }
}
