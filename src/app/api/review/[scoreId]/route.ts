import { NextResponse } from "next/server"
import { loadLocalApplicationConfig } from "@/features/local-application"
import {
  addCandidateCorrection,
  CORRECTION_TARGETS,
  REJECTION_REASONS,
  REVIEW_STATUSES,
  updateCandidateReview,
} from "@/features/review-queue/infrastructure/review-candidate"
import { getQueueCandidate } from "@/features/review-queue/server/review-queue-read-model"
import { assertSameOrigin } from "@/features/workspace-administration"

export async function POST(request: Request, context: { params: Promise<{ scoreId: string }> }) {
  try {
    assertSameOrigin(request)
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
      if (body.note !== undefined && typeof body.note !== "string")
        throw new Error("invalid correction note")
      addCandidateCorrection(databasePath, scoreId, {
        target: body.target as (typeof CORRECTION_TARGETS)[number],
        correctedValue: body.correctedValue,
        ...(typeof body.note === "string" ? { note: body.note } : {}),
      })
    } else {
      if (typeof body.status !== "string" || !REVIEW_STATUSES.includes(body.status as never))
        throw new Error("invalid review")
      if (
        body.rejectionReason !== undefined &&
        body.rejectionReason !== "" &&
        (typeof body.rejectionReason !== "string" ||
          !REJECTION_REASONS.includes(body.rejectionReason as never))
      )
        throw new Error("invalid rejection reason")
      if (body.rejectionNote !== undefined && typeof body.rejectionNote !== "string")
        throw new Error("invalid rejection note")
      if (body.privateNotes !== undefined && typeof body.privateNotes !== "string")
        throw new Error("invalid private notes")
      if (
        body.followUpAt !== undefined &&
        body.followUpAt !== null &&
        typeof body.followUpAt !== "string"
      )
        throw new Error("invalid follow-up date")
      updateCandidateReview(databasePath, scoreId, {
        status: body.status as (typeof REVIEW_STATUSES)[number],
        ...(typeof body.rejectionReason === "string" && body.rejectionReason !== ""
          ? { rejectionReason: body.rejectionReason as (typeof REJECTION_REASONS)[number] }
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
  try {
    const { scoreId } = await context.params
    const candidate = getQueueCandidate(scoreId)
    if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
    return NextResponse.json(candidate)
  } catch {
    return NextResponse.json({ error: "Candidate details could not be read." }, { status: 500 })
  }
}
