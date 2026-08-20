"use client"

import { ChevronLeft, ChevronRight, CircleCheck, CircleX, MapPin, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { REJECTION_REASONS } from "@/features/review-queue/domain/review-policy"
import { CandidateDecision } from "@/features/review-queue/presentation/candidate-decision"
import { CandidateEvidence } from "@/features/review-queue/presentation/candidate-evidence"
import { CandidateHistory } from "@/features/review-queue/presentation/candidate-history"
import { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
import { formatScore, humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

export type QuickDecision = Readonly<{
  status: "Shortlisted" | "Rejected" | "Unreviewed"
  rejectionReason?: string
  rejectionNote?: string
}>

/**
 * One candidate at full size, over the queue rather than beside it. The two decisions that dominate
 * reviewing sit in the header where they are always reachable, and recording one moves straight on to
 * the next candidate, so a long queue can be worked through without returning to the list.
 */
export function CandidateSheet({
  candidate,
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
  candidate?: QueueCandidate
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
                candidate={candidate}
                busy={busy}
                onQuickDecision={onQuickDecision}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            </SheetHeader>

            <Separator />

            {/* The panel owns the scrolling, so the header and footer stay put however long the
                evidence runs. */}
            <Tabs defaultValue="evidence" className="min-h-0 flex-1 gap-0">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="decision">Decision</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <div className="p-4">
                  <TabsContent value="evidence">
                    <CandidateEvidence candidate={candidate} />
                  </TabsContent>
                  <TabsContent value="decision">
                    <CandidateDecision candidate={candidate} busy={busy} onSubmit={onSaveReview} />
                  </TabsContent>
                  <TabsContent value="history">
                    <CandidateHistory
                      candidate={candidate}
                      busy={busy}
                      onCorrect={onCorrect}
                      onSuppress={onSuppress}
                    />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>

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
 * The two decisions that dominate reviewing, plus the reason a rejection needs. Mounted per candidate
 * so its state resets by remounting rather than by an effect watching the selection.
 */
function CandidateDecisionBar({
  candidate,
  busy,
  onQuickDecision,
  onPrevious,
  onNext,
}: {
  candidate: QueueCandidate
  busy: boolean
  onQuickDecision: (decision: QuickDecision) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0])
  const [note, setNote] = useState("")

  // "Other" is the one reason the server insists on a note for, so the button waits for one.
  const rejectionIncomplete = reason === "Other" && note.trim() === ""

  const shortlist = () => onQuickDecision({ status: "Shortlisted" })
  const reject = () => {
    if (rejectionIncomplete) return
    onQuickDecision({ status: "Rejected", rejectionReason: reason, rejectionNote: note })
  }

  useKeyboardShortcuts({
    enabled: !busy,
    onShortlist: shortlist,
    onReject: () => setRejecting(true),
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
        {candidate.reviewStatus !== "Unreviewed" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onQuickDecision({ status: "Unreviewed" })}
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Reset
          </Button>
        ) : null}
      </div>

      {rejecting ? (
        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="quick-reason">Rejection Reason</FieldLabel>
            <Select value={reason} onValueChange={(value) => setReason(value ?? "Other")}>
              <SelectTrigger id="quick-reason" size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {REJECTION_REASONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {humanizeTerm(value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5" data-invalid={rejectionIncomplete || undefined}>
            <FieldLabel htmlFor="quick-note">Rejection Note</FieldLabel>
            <Input
              id="quick-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={rejectionIncomplete || undefined}
            />
            <FieldDescription>
              {rejectionIncomplete
                ? "A note is required when the reason is Other."
                : "Optional for every reason except Other."}
            </FieldDescription>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy || rejectionIncomplete}
              onClick={reject}
            >
              Confirm Rejection
            </Button>
          </div>
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
  onPrevious,
  onNext,
}: {
  enabled: boolean
  onShortlist: () => void
  onReject: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  // The handlers are fresh closures on every render. Held in a ref, the window listener subscribes
  // once per open panel instead of being torn down and rebuilt on each render.
  const handlers = useRef({ onShortlist, onReject, onPrevious, onNext })
  handlers.current = { onShortlist, onReject, onPrevious, onNext }

  useEffect(() => {
    if (!enabled) return
    const handle = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input,textarea,select,[contenteditable=true],[role=combobox]")) return

      const current = handlers.current
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
