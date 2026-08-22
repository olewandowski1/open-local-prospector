"use client"

import { FilterRemoveIcon } from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/icon"
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
import {
  ALL,
  emptyQueueFilter,
  filterQueueCandidates,
  humanizeTerm,
  type QueueFilter,
  queueFilterOptions,
} from "@/features/review-queue/presentation/review-presentation"
import type {
  QueueCandidate,
  QueueCandidateSummary,
} from "@/features/review-queue/server/review-queue-read-model"

const FILTER_STORAGE_KEY = "v1:review-filter"
const SELECTION_STORAGE_KEY = "v1:review-selection"

export function ReviewWorkspace({ candidates }: { candidates: readonly QueueCandidateSummary[] }) {
  const router = useRouter()
  const requestedId = useSearchParams().get("candidate")
  const [filter, setFilter] = useState<QueueFilter>(emptyQueueFilter)
  const [openId, setOpenId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    if (stored) setFilter({ ...emptyQueueFilter, status: stored })
  }, [])

  useEffect(() => {
    if (requestedId === null) return
    if (!candidates.some((candidate) => candidate.id === requestedId)) return
    setOpenId(requestedId)
    // A saved filter could otherwise hide the very candidate the link was followed to reach.
    setFilter(emptyQueueFilter)
  }, [candidates, requestedId])

  const options = useMemo(() => queueFilterOptions(candidates), [candidates])
  const visible = useMemo(() => filterQueueCandidates(candidates, filter), [candidates, filter])

  const index = openId ? visible.findIndex((candidate) => candidate.id === openId) : -1
  const open = index >= 0 ? visible[index] : undefined

  const detail = useQuery({
    queryKey: ["review-candidate", open?.id],
    queryFn: () => fetchCandidate(open?.id ?? ""),
    enabled: open !== undefined,
    staleTime: 30_000,
  })

  // Only the review status is remembered: a saved town would quietly hide a run made later
  // somewhere else, and the reader would have no idea the queue was holding anything back.
  const selectFilter = (next: Partial<QueueFilter>) => {
    setFilter((current) => {
      const merged = { ...current, ...next }
      localStorage.setItem(FILTER_STORAGE_KEY, merged.status)
      return merged
    })
  }

  const openCandidate = useCallback((id: string) => {
    setOpenId(id)
    localStorage.setItem(SELECTION_STORAGE_KEY, id)
  }, [])

  const step = (offset: number) => {
    const next = visible[index + offset]
    if (next) openCandidate(next.id)
  }

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

  // Notes and follow-up date are sent back untouched: the write replaces every column it is given.
  const quickDecision = async (decision: QuickDecision) => {
    if (!open) return
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

  const exportQuery = filter.status === ALL ? "" : `&status=${encodeURIComponent(filter.status)}`

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action Not Completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <QueueFilterSelect
            label="Status"
            value={filter.status}
            allLabel="All Statuses"
            options={REVIEW_STATUSES}
            onChange={(status) => selectFilter({ status })}
          />
          {options.localities.length > 1 ? (
            <QueueFilterSelect
              label="Town"
              value={filter.locality}
              allLabel="All Towns"
              options={options.localities}
              onChange={(locality) => selectFilter({ locality })}
            />
          ) : null}
          {options.opportunities.length > 1 ? (
            <QueueFilterSelect
              label="Opportunity"
              value={filter.opportunity}
              allLabel="All Opportunities"
              options={options.opportunities}
              format={humanizeTerm}
              onChange={(opportunity) => selectFilter({ opportunity })}
            />
          ) : null}
        </div>

        <ExportDialog
          statusFilter={filter.status}
          count={visible.length}
          exportQuery={exportQuery}
        />
      </div>

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={FilterRemoveIcon} />
            </EmptyMedia>
            <EmptyTitle>Nothing Matches These Filters</EmptyTitle>
            <EmptyDescription>
              The queue holds {candidates.length}{" "}
              {candidates.length === 1 ? "candidate" : "candidates"}, and none of them match every
              filter you have set.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => selectFilter(emptyQueueFilter)}>
              Clear Filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div>
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

function QueueFilterSelect({
  label,
  value,
  allLabel,
  options,
  format,
  onChange,
}: {
  label: string
  value: string
  allLabel: string
  options: readonly string[]
  format?: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL)}>
      <SelectTrigger size="sm" aria-label={`${label} Filter`} className="w-[12rem]">
        <span className="text-muted-foreground">{label}</span>
        {/* An opportunity is stored as `NoDedicatedWebsite`; the trigger must not say that. */}
        <SelectValue>
          {(option: string) => (option === ALL ? allLabel : format ? format(option) : option)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format ? format(option) : option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
