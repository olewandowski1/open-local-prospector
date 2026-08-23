import { NextResponse } from "next/server"
import { loadLocalApplicationConfig } from "@/features/local-application"
import { suppressCandidate } from "@/features/review-queue/infrastructure/suppress-candidate"
import { assertSameOrigin } from "@/features/workspace-administration"

export async function POST(request: Request, context: { params: Promise<{ scoreId: string }> }) {
  try {
    assertSameOrigin(request)
    const { scoreId } = await context.params
    const body = (await request.json()) as { reason?: unknown }
    if (typeof body.reason !== "string") throw new Error("Suppression reason is required.")
    suppressCandidate(loadLocalApplicationConfig().databasePath, scoreId, body.reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suppression failed." },
      { status: 400 },
    )
  }
}
