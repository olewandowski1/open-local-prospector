"use client"

import { useQuery } from "@tanstack/react-query"
import { FilterX } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { REVIEW_STATUSES } from "@/features/review-queue/domain/review-policy"
import {
  CandidateSheet,
  type QuickDecision,
} from "@/features/review-queue/presentation/candidate-sheet"
import { CandidatesTable } from "@/features/review-queue/presentation/candidates-table"
import { ExportDialog } from "@/features/review-queue/presentation/export-dialog"
import type {
  QueueCandidate,
  QueueCandidateSummary,
} from "@/features/review-queue/server/review-queue-read-model"

const FILTER_STORAGE_KEY = "v1:review-filter"
const SELECTION_STORAGE_KEY = "v1:review-selection"

export function ReviewWorkspace({ candidates }: { candidates: readonly QueueCandidateSummary[] }) {
  const router = useRouter()
  const requestedId = useSearchParams().get("candidate")
  const [filter, setFilter] = useState("All")
  const [openId, setOpenId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    if (stored) setFilter(stored)
  }, [])

  // A candidate named in the address opens straight away: arriving from a link is a deliberate choice.
  useEffect(() => {
    if (requestedId === null) return
    if (!candidates.some((candidate) => candidate.id === requestedId)) return
    setOpenId(requestedId)
    // A saved filter could otherwise hide the very candidate the link was followed to reach.
    setFilter("All")
  }, [candidates, requestedId])

  const visible = useMemo(
    () =>
      filter === "All"
        ? candidates
        : candidates.filter((candidate) => candidate.reviewStatus === filter),
    [candidates, filter],
  )

  const index = openId ? visible.findIndex((candidate) => candidate.id === openId) : -1
  const open = index >= 0 ? visible[index] : undefined

  // The evidence is fetched for the one candidate on screen instead of shipped for the whole queue,
  // and React Query keeps it for a candidate revisited while stepping back and forth.
  const detail = useQuery({
    queryKey: ["review-candidate", open?.id],
    queryFn: () => fetchCandidate(open?.id ?? ""),
    enabled: open !== undefined,
    staleTime: 30_000,
  })

  const selectFilter = (value: string) => {
    setFilter(value)
    localStorage.setItem(FILTER_STORAGE_KEY, value)
  }

  const openCandidate = useCallback((id: string) => {
    setOpenId(id)
    localStorage.setItem(SELECTION_STORAGE_KEY, id)
  }, [])

  const step = (offset: number) => {
    const next = visible[index + offset]
    if (next) openCandidate(next.id)
  }

  /** Re-renders the server component that reads SQLite, rather than reloading the whole document. */
  const refresh = () => router.refresh()

  const post = async (path: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(result.error ?? "Could not save.")
        return false
      }
      refresh()
      await detail.refetch()
      return true
    } finally {
      setBusy(false)
    }
  }

  /**
   * Records one of the two decisions that dominate reviewing and moves on. The stored notes and
   * follow-up date are sent back untouched because the write replaces every column it is given, so
   * omitting them would quietly erase work done in the Decision tab.
   */
  const quickDecision = async (decision: QuickDecision) => {
    if (!open) return
    // The write replaces every column it is given, so a decision waits for the values it must return.
    const loaded = detail.data
    if (!loaded) return
    const nextCandidate = visible[index + 1]
    const saved = await post(`/api/review/${open.id}`, {
      kind: "review",
      status: decision.status,
      ...(decision.rejectionReason ? { rejectionReason: decision.rejectionReason } : {}),
      ...(decision.rejectionNote ? { rejectionNote: decision.rejectionNote } : {}),
      privateNotes: loaded.privateNotes,
      followUpAt: loaded.followUpAt ?? null,
    })
    if (!saved) return

    // Advancing keeps a long queue moving; at the end the panel stays on the last candidate.
    if (nextCandidate) openCandidate(nextCandidate.id)
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!open) return
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    void post(`/api/review/${open.id}`, body)
  }

  const suppress = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!open) return
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "")
    void post(`/api/review/${open.id}/suppress`, { reason }).then((saved) => {
      if (saved) {
        setOpenId(undefined)
      }
    })
  }

  const deleteBusiness = async (confirmation: string) => {
    if (!open) return false
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/review/${encodeURIComponent(open.id)}/delete`, {
        method: "DELETE",
        headers: { "X-Workspace-Confirmation": confirmation },
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        leftoverFiles?: number
      }
      if (!response.ok) throw new Error(body.error ?? "The business was not deleted.")
      setOpenId(undefined)
      if ((body.leftoverFiles ?? 0) > 0) {
        setError(
          `The business was deleted, but ${body.leftoverFiles} artifact ${body.leftoverFiles === 1 ? "file remains" : "files remain"} on disk. Check the Data cleanup tools.`,
        )
      }
      refresh()
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : "The business was not deleted.")
      return false
    } finally {
      setBusy(false)
    }
  }

  const exportQuery = filter === "All" ? "" : `&status=${encodeURIComponent(filter)}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action Not Completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filter} onValueChange={(value) => selectFilter(value ?? "All")}>
          <SelectTrigger size="sm" aria-label="Review Status Filter" className="w-[11rem]">
            <span className="text-muted-foreground">Status</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="All">All Statuses</SelectItem>
              {REVIEW_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <ExportDialog statusFilter={filter} count={visible.length} exportQuery={exportQuery} />
      </div>

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FilterX />
            </EmptyMedia>
            <EmptyTitle>No Candidates With This Status</EmptyTitle>
            <EmptyDescription>
              The queue holds {candidates.length}{" "}
              {candidates.length === 1 ? "candidate" : "candidates"}, none of them {filter}.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => selectFilter("All")}>
              Show All Statuses
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        // The queue takes the height that is left and scrolls inside itself.
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CandidatesTable candidates={visible} selectedId={open?.id} onOpen={openCandidate} />
        </div>
      )}

      <CandidateSheet
        candidate={open}
        detail={detail.data}
        position={index + 1}
        total={visible.length}
        busy={busy}
        canPrevious={index > 0}
        canNext={index >= 0 && index < visible.length - 1}
        onOpenChange={(next) => {
          if (!next) setOpenId(undefined)
        }}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onQuickDecision={(decision) => void quickDecision(decision)}
        onSaveReview={submitForm}
        onCorrect={submitForm}
        onSuppress={suppress}
        onDeleteBusiness={deleteBusiness}
      />
    </div>
  )
}

async function fetchCandidate(scoreId: string): Promise<QueueCandidate> {
  const response = await fetch(`/api/review/${encodeURIComponent(scoreId)}`)
  if (!response.ok) throw new Error("candidate unavailable")
  return (await response.json()) as QueueCandidate
}
