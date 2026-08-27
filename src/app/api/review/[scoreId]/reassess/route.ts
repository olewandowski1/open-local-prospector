import { NextResponse } from "next/server"

import {
  createReassessmentRun,
  RuntimeNotReadyForReassessment,
} from "@/features/prospecting-runs/server/reassessment-services"
import { getReassessmentTarget } from "@/features/review-queue/server/review-queue-read-model"
import { assertSameOrigin, withWorkspaceAdmission } from "@/features/workspace-administration"

export async function POST(request: Request, context: { params: Promise<{ scoreId: string }> }) {
  try {
    assertSameOrigin(request)
    const { scoreId } = await context.params
    const target = getReassessmentTarget(scoreId)
    if (!target) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
    }
    const run = await withWorkspaceAdmission(() =>
      createReassessmentRun({
        canonicalBusinessId: target.canonicalBusinessId,
        sourceSearchBrief: target.sourceSearchBrief,
        // Repeating the request reuses the run this score already asked for.
        requestId: `reassess:${scoreId}`,
      }),
    )
    return NextResponse.json({ id: run.id, state: run.state }, { status: 201 })
  } catch (error) {
    if (error instanceof RuntimeNotReadyForReassessment) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof Error && error.message.includes("maintenance")) {
      return NextResponse.json(
        { error: "Workspace maintenance is in progress. Try again when it finishes." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: "The reassessment was not started." }, { status: 400 })
  }
}
