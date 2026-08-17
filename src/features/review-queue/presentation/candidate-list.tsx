"use client"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { REVIEW_STATUSES } from "@/features/review-queue/domain/review-policy"
import { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
import { formatScore, humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"
import { cn } from "@/lib/utils"

export function CandidateList({
  candidates,
  filter,
  selectedId,
  onFilter,
  onSelect,
}: {
  candidates: readonly QueueCandidate[]
  filter: string
  selectedId?: string
  onFilter: (status: string) => void
  onSelect: (id: string) => void
}) {
  const exportQuery = filter === "All" ? "" : `&status=${encodeURIComponent(filter)}`

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>Ranked Candidates</CardTitle>
        <CardDescription>Selection and filter persist on this device.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="review-filter">Review Status</FieldLabel>
          <Select value={filter} onValueChange={(value) => onFilter(value ?? "All")}>
            <SelectTrigger id="review-filter" aria-label="Review Status Filter" className="w-full">
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
        </Field>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates match this filter.</p>
        ) : (
          <ul className="-mx-1 flex max-h-[28rem] flex-col gap-1 overflow-y-auto px-1">
            {candidates.map((candidate) => {
              const selected = candidate.id === selectedId
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(candidate.id)}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected
                        ? "border-foreground/30 bg-muted"
                        : "border-transparent hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{candidate.name}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatScore(candidate.score)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {candidate.locality} · {humanizeTerm(candidate.primaryOpportunity)}
                      </span>
                      <CandidateStatusBadge status={candidate.reviewStatus} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex gap-2 border-t pt-3">
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/api/export?format=csv${exportQuery}`}
          >
            Export CSV
          </a>
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/api/export?format=json${exportQuery}`}
          >
            Export JSON
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
