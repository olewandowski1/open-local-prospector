"use client"

import {
  Alert01Icon,
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { cn } from "@/lib/utils"

export type QuickDecision = Readonly<{
  status: "Shortlisted" | "Rejected" | "Unreviewed" | "Contacted" | "Archived"
  rejectionReason?: string
  rejectionNote?: string
}>

const secondaryStatuses = ["Contacted", "Archived"] as const
const scoreSkeletonKeys = ["severity", "confidence", "contact", "decision", "value"] as const
const skeletonRowKeys = ["first", "second", "third"] as const

export function CandidateSheet({
  candidate,
  detail,
  detailError,
  position,
  total,
  busy,
  canPrevious,
  canNext,
  onOpenChange,
  onPrevious,
  onNext,
  onRetryDetail,
  onQuickDecision,
  onSaveReview,
  onCorrect,
  onSuppress,
  onDeleteBusiness,
}: {
  candidate?: QueueCandidateSummary
  detail?: QueueCandidate
  detailError?: string
  position: number
  total: number
  busy: boolean
  canPrevious: boolean
  canNext: boolean
  onOpenChange: (open: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onRetryDetail: () => void
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
                {detailError ? (
                  <DetailError message={detailError} onRetry={onRetryDetail} />
                ) : detail === undefined ? (
                  <ReviewDetailSkeleton />
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

function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Empty role="alert" className="min-h-80">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/15 text-destructive">
          <Icon icon={Alert01Icon} />
        </EmptyMedia>
        <EmptyTitle>Candidate Could Not Be Loaded</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="destructive" size="lg" onClick={onRetry}>
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ReviewDetailSkeleton() {
  return (
    // A bare div takes no accessible name, so the status role carries it.
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading Candidate Details"
      className="flex flex-col gap-8"
    >
      <SkeletonSection titleWidth="w-36" descriptionWidth="w-4/5">
        <div className="grid gap-2.5">
          {scoreSkeletonKeys.map((key) => (
            <div key={key} className="grid gap-1">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </SkeletonSection>

      <Separator />
      <SkeletonSection titleWidth="w-28" descriptionWidth="w-72">
        <SkeletonRows rows={2} />
      </SkeletonSection>

      <Separator />
      <SkeletonSection titleWidth="w-40" descriptionWidth="w-80">
        <SkeletonRows rows={2} />
      </SkeletonSection>

      <Separator />
      <SkeletonSection titleWidth="w-52" descriptionWidth="w-4/5">
        <SkeletonRows rows={3} compact />
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <SkeletonRows rows={2} compact />
        </div>
      </SkeletonSection>

      <div className="grid divide-y rounded-lg border px-3">
        {skeletonRowKeys.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border border-destructive/40 p-4">
        <Skeleton className="h-4 w-24" />
        <SkeletonRows rows={2} />
      </div>
    </div>
  )
}

function SkeletonSection({
  titleWidth,
  descriptionWidth,
  children,
}: {
  titleWidth: string
  descriptionWidth: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Skeleton className={cn("h-4", titleWidth)} />
        <Skeleton className={cn("h-3", descriptionWidth)} />
      </div>
      {children}
    </section>
  )
}

function SkeletonRows({ rows, compact = false }: { rows: number; compact?: boolean }) {
  return (
    <div className="grid divide-y rounded-lg border">
      {skeletonRowKeys.slice(0, rows).map((key) => (
        <div key={key} className="grid gap-2 p-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          {compact ? null : <Skeleton className="h-3 w-4/5" />}
        </div>
      ))}
    </div>
  )
}
