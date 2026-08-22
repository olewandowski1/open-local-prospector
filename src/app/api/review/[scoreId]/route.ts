import { NextResponse } from "next/server"
import { loadLocalApplicationConfig } from "@/features/local-application"
import {
  addCandidateCorrection,
  CORRECTION_TARGETS,
  REVIEW_STATUSES,
  updateCandidateReview,
} from "@/features/review-queue/infrastructure/review-candidate"
import { getQueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

export async function POST(request: Request, context: { params: Promise<{ scoreId: string }> }) {
  try {
    const { scoreId } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const databasePath = loadLocalApplicationConfig().databasePath
    if (body.kind === "correction") {
      if (
        typeof body.target !== "string" ||
        !CORRECTION_TARGETS.includes(body.target as never) ||
        typeof body.correctedValue !== "string"
      )
        throw new Error("invalid correction")
      addCandidateCorrection(databasePath, scoreId, {
        target: body.target as (typeof CORRECTION_TARGETS)[number],
        correctedValue: body.correctedValue,
        ...(typeof body.note === "string" ? { note: body.note } : {}),
      })
    } else {
      if (typeof body.status !== "string" || !REVIEW_STATUSES.includes(body.status as never))
        throw new Error("invalid review")
      updateCandidateReview(databasePath, scoreId, {
        status: body.status as (typeof REVIEW_STATUSES)[number],
        ...(typeof body.rejectionReason === "string"
          ? { rejectionReason: body.rejectionReason as never }
          : {}),
        ...(typeof body.rejectionNote === "string" ? { rejectionNote: body.rejectionNote } : {}),
        ...(typeof body.privateNotes === "string" ? { privateNotes: body.privateNotes } : {}),
        ...(typeof body.followUpAt === "string" || body.followUpAt === null
          ? { followUpAt: body.followUpAt }
          : {}),
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review update failed." },
      { status: 400 },
    )
  }
}

export async function GET(_request: Request, context: { params: Promise<{ scoreId: string }> }) {
  const { scoreId } = await context.params
  const candidate = getQueueCandidate(scoreId)
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
  return NextResponse.json(candidate)
}
