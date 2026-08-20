"use client"

import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Ellipsis,
  MapPin,
  RotateCcw,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
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
import { CandidateDecision } from "@/features/review-queue/presentation/candidate-decision"
import { CandidateEvidence } from "@/features/review-queue/presentation/candidate-evidence"
import { CandidateHistory } from "@/features/review-queue/presentation/candidate-history"
import { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
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

/** Statuses that are real outcomes but not the two a reviewer reaches for constantly. */
const secondaryStatuses = ["Contacted", "Archived"] as const

/**
 * One candidate at full size, over the queue rather than beside it.
 *
 * Deciding is never behind a tab or a form: the evidence is on screen the moment the panel opens, the
 * two decisions that dominate reviewing sit above it, and rejecting is picking the reason. Recording
 * one moves straight on to the next candidate, so a long queue can be worked through without
 * returning to the list.
 */
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
}: {
  candidate?: QueueCandidateSummary
  /** The evidence, which arrives after the panel opens. */
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
}) {
  const open = candidate !== undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The width prefix matches the primitive's own rule so the merge replaces rather than collides. */}
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        {candidate ? (
          <>
            <SheetHeader className="gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate">{candidate.name}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {candidate.locality}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{humanizeTerm(candidate.primaryOpportunity)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Score {formatScore(candidate.score)}</span>
                  </SheetDescription>
                </div>
                <CandidateStatusBadge status={candidate.reviewStatus} />
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

            {/* One column, in the order a reviewer works: read the evidence, note anything, look back
                at the history. The panel owns the scrolling so the header and footer stay put. */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-8 p-4">
                {detail === undefined ? (
                  <EvidenceSkeleton />
                ) : (
                  <>
                    <CandidateEvidence candidate={detail} />
                    <CandidateDecision candidate={detail} busy={busy} onSubmit={onSaveReview} />
                    <CandidateHistory
                      candidate={detail}
                      busy={busy}
                      onCorrect={onCorrect}
                      onSuppress={onSuppress}
                    />
                  </>
                )}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-row items-center justify-between gap-3 border-t p-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {position} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPrevious || busy}
                  onClick={onPrevious}
                >
                  <ChevronLeft data-icon="inline-start" aria-hidden="true" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!canNext || busy} onClick={onNext}>
                  Next
                  <ChevronRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Shortlisting is one click. Rejecting is two: the button reveals the reasons, and choosing one is the
 * decision — there is no form to fill and nothing to confirm, because every reason is a complete
 * answer on its own. "Other" is the exception the write insists on a note for.
 *
 * Mounted per candidate so its state resets by remounting rather than by an effect watching the
 * selection.
 */
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
          <CircleCheck data-icon="inline-start" aria-hidden="true" />
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
          <CircleX data-icon="inline-start" aria-hidden="true" />
          Reject
          <Kbd className="ml-1">R</Kbd>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" disabled={busy} aria-label="More Decisions">
                <Ellipsis aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {secondaryStatuses.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onQuickDecision({ status })}
                  disabled={busy || reviewStatus === status}
                >
                  Mark {status}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => onQuickDecision({ status: "Unreviewed" })}
                disabled={busy || reviewStatus === "Unreviewed"}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                Reset To Unreviewed
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
          <Field className="gap-1.5 pt-1">
            <FieldLabel htmlFor="reject-other">Other</FieldLabel>
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
            <FieldDescription>A reason of its own needs a note.</FieldDescription>
          </Field>
        </div>
      ) : null}
    </>
  )
}

/**
 * Single-key shortcuts for the actions a reviewer repeats most. They stand down while a field has
 * focus so typing a note never records a decision.
 */
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
  // The handlers are fresh closures on every render. Held in a ref, the window listener subscribes
  // once per open panel instead of being torn down and rebuilt on each render.
  const handlers = useRef({ onShortlist, onReject, onCancel, onPrevious, onNext })
  handlers.current = { onShortlist, onReject, onCancel, onPrevious, onNext }

  useEffect(() => {
    if (!enabled) return
    const handle = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const typing = target?.closest("input,textarea,select,[contenteditable=true],[role=combobox]")
      const current = handlers.current
      // Escape still closes the reason list while a note is being typed.
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

/** Stands in for the evidence while it is fetched, so the panel does not resize when it lands. */
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
