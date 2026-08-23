"use client"

import {
  ArchiveIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  CancelCircleIcon,
  ChartLineData01Icon,
  CheckmarkCircle02Icon,
  MapPinIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { FormFieldLabel } from "@/components/form-field-label"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { REJECTION_REASONS } from "@/features/review-queue/domain/review-policy"
import { CandidateAdmin } from "@/features/review-queue/presentation/candidate-admin"
import { CandidateDangerZone } from "@/features/review-queue/presentation/candidate-danger-zone"
import { CandidateEvidence } from "@/features/review-queue/presentation/candidate-evidence"
import { formatScore, humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type {
  QueueCandidate,
  QueueCandidateSummary,
} from "@/features/review-queue/server/review-queue-read-model"

export type QuickDecision = Readonly<{
  status: "Shortlisted" | "Rejected" | "Unreviewed" | "Contacted" | "Archived"
  rejectionReason?: string
  rejectionNote?: string
}>

const secondaryStatuses = ["Contacted", "Archived"] as const

export function CandidateSheet({
  candidate,
  detail,
  position,
  total,
  busy,
  canPrevious,
  canNext,
  onOpenChange,
  onPrevious,
  onNext,
  onQuickDecision,
  onSaveReview,
  onCorrect,
  onSuppress,
  onDeleteBusiness,
}: {
  candidate?: QueueCandidateSummary
  detail?: QueueCandidate
  position: number
  total: number
  busy: boolean
  canPrevious: boolean
  canNext: boolean
  onOpenChange: (open: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onQuickDecision: (decision: QuickDecision) => void
  onSaveReview: (event: React.FormEvent<HTMLFormElement>) => void
  onCorrect: (event: React.FormEvent<HTMLFormElement>) => void
  onSuppress: (event: React.FormEvent<HTMLFormElement>) => void
  onDeleteBusiness: (confirmation: string) => Promise<boolean>
}) {
  const open = candidate !== undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The width prefix matches the primitive's own rule so the merge replaces rather than collides. */}
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        {candidate ? (
          <>
            <SheetHeader className="gap-3 p-4">
              <div className="min-w-0 pr-8">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <SheetTitle className="truncate">{candidate.name}</SheetTitle>
                  {/* The one number the whole panel exists to justify, beside the name it belongs to. */}
                  <span className="inline-flex shrink-0 items-center gap-1 text-success">
                    <Icon icon={ChartLineData01Icon} className="size-4" />
                    <span className="text-sm font-semibold tabular-nums">
                      Score {formatScore(candidate.score)}
                    </span>
                  </span>
                </div>
                <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Icon icon={MapPinIcon} className="size-3.5" />
                    {candidate.locality}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{humanizeTerm(candidate.primaryOpportunity)}</span>
                </SheetDescription>
              </div>

              {/* Keyed on the candidate so a half-written rejection never carries over to the next. */}
              <CandidateDecisionBar
                key={candidate.id}
                reviewStatus={candidate.reviewStatus}
                busyOrLoading={busy || detail === undefined}
                onQuickDecision={onQuickDecision}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            </SheetHeader>

            <Separator />

            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-8 p-4">
                {detail === undefined ? (
                  <EvidenceSkeleton />
                ) : (
                  <>
                    <CandidateEvidence candidate={detail} />
                    <CandidateAdmin
                      candidate={detail}
                      busy={busy}
                      onSaveReview={onSaveReview}
                      onCorrect={onCorrect}
                    />
                    <CandidateDangerZone
                      candidate={detail}
                      busy={busy}
                      onSuppress={onSuppress}
                      onDeleteBusiness={onDeleteBusiness}
                    />
                  </>
                )}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-row items-center justify-between gap-3 border-t p-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                Review {position} / {total}
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Previous Candidate"
                  variant="outline"
                  size="icon-sm"
                  disabled={!canPrevious || busy}
                  onClick={onPrevious}
                >
                  <Icon icon={ArrowLeft01Icon} />
                </IconButton>
                <IconButton
                  label="Next Candidate"
                  variant="outline"
                  size="icon-sm"
                  disabled={!canNext || busy}
                  onClick={onNext}
                >
                  <Icon icon={ArrowRight01Icon} />
                </IconButton>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CandidateDecisionBar({
  reviewStatus,
  busyOrLoading: busy,
  onQuickDecision,
  onPrevious,
  onNext,
}: {
  reviewStatus: string
  busyOrLoading: boolean
  onQuickDecision: (decision: QuickDecision) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")

  const shortlist = () => onQuickDecision({ status: "Shortlisted" })
  const rejectWith = (reason: string) =>
    onQuickDecision({ status: "Rejected", rejectionReason: reason })

  useKeyboardShortcuts({
    enabled: !busy,
    onShortlist: shortlist,
    onReject: () => setRejecting(true),
    onCancel: () => setRejecting(false),
    onPrevious,
    onNext,
  })

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="success" size="sm" disabled={busy} onClick={shortlist}>
          <Icon icon={CheckmarkCircle02Icon} data-icon="inline-start" />
          Shortlist
          <Kbd className="ml-1">S</Kbd>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => setRejecting((current) => !current)}
          aria-expanded={rejecting}
        >
          <Icon icon={CancelCircleIcon} data-icon="inline-start" />
          Reject
          <Kbd className="ml-1">R</Kbd>
        </Button>

        <Button
          variant="info"
          size="sm"
          disabled={busy || reviewStatus === secondaryStatuses[0]}
          onClick={() => onQuickDecision({ status: secondaryStatuses[0] })}
        >
          <Icon icon={SentIcon} data-icon="inline-start" />
          Mark Contacted
        </Button>
        <Button
          variant="warning"
          size="sm"
          disabled={busy || reviewStatus === secondaryStatuses[1]}
          onClick={() => onQuickDecision({ status: secondaryStatuses[1] })}
        >
          <Icon icon={ArchiveIcon} data-icon="inline-start" />
          Mark Archived
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || reviewStatus === "Unreviewed"}
          onClick={() => onQuickDecision({ status: "Unreviewed" })}
        >
          <Icon icon={ArrowTurnBackwardIcon} data-icon="inline-start" />
          Reset To Unreviewed
        </Button>
      </div>

      {rejecting ? (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Why is this not a fit? Choosing a reason records the rejection.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REJECTION_REASONS.filter((reason) => reason !== "Other").map((reason) => (
              <Button
                key={reason}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => rejectWith(reason)}
              >
                {humanizeTerm(reason)}
              </Button>
            ))}
          </div>

          {/* "Other" cannot be a single click: the write rejects it without a note. */}
          <Field className="gap-1 pt-1">
            <FormFieldLabel
              htmlFor="reject-other"
              label="Other"
              description="A reason of its own needs a note."
            />
            <div className="flex items-center gap-2">
              <Input
                id="reject-other"
                value={note}
                placeholder="Say why in a few words"
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || note.trim() === "") return
                  event.preventDefault()
                  onQuickDecision({
                    status: "Rejected",
                    rejectionReason: "Other",
                    rejectionNote: note,
                  })
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || note.trim() === ""}
                onClick={() =>
                  onQuickDecision({
                    status: "Rejected",
                    rejectionReason: "Other",
                    rejectionNote: note,
                  })
                }
              >
                Reject
              </Button>
            </div>
          </Field>
        </div>
      ) : null}
    </>
  )
}

// Shortcuts stand down while a field has focus, so typing a note never records a decision.
function useKeyboardShortcuts({
  enabled,
  onShortlist,
  onReject,
  onCancel,
  onPrevious,
  onNext,
}: {
  enabled: boolean
  onShortlist: () => void
  onReject: () => void
  onCancel: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  // Held in a ref so the window listener subscribes once per open panel rather than on every render.
  const handlers = useRef({ onShortlist, onReject, onCancel, onPrevious, onNext })
  handlers.current = { onShortlist, onReject, onCancel, onPrevious, onNext }

  useEffect(() => {
    if (!enabled) return
    const handle = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const typing = target?.closest("input,textarea,select,[contenteditable=true],[role=combobox]")
      const current = handlers.current
      if (event.key === "Escape") {
        current.onCancel()
        return
      }
      if (typing) return

      const actions: Readonly<Record<string, () => void>> = {
        s: current.onShortlist,
        r: current.onReject,
        j: current.onNext,
        k: current.onPrevious,
        ArrowDown: current.onNext,
        ArrowUp: current.onPrevious,
      }
      const action = actions[event.key] ?? actions[event.key.toLowerCase()]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [enabled])
}

function EvidenceSkeleton() {
  return (
    // A bare div takes no accessible name, so the status role carries it.
    <div role="status" aria-busy="true" aria-label="Loading Evidence" className="grid gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
}
