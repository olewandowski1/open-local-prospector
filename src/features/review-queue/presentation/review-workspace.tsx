"use client"

import { MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CandidateDecision } from "@/features/review-queue/presentation/candidate-decision"
import { CandidateEvidence } from "@/features/review-queue/presentation/candidate-evidence"
import { CandidateHistory } from "@/features/review-queue/presentation/candidate-history"
import { CandidateList } from "@/features/review-queue/presentation/candidate-list"
import { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
import { formatScore, humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"
import { cn } from "@/lib/utils"

type DetailSection = "evidence" | "decision" | "history"

const sections: readonly Readonly<{ value: DetailSection; label: string }>[] = [
  { value: "evidence", label: "Evidence" },
  { value: "decision", label: "Decision" },
  { value: "history", label: "History" },
]

export function ReviewWorkspace({ candidates }: { candidates: readonly QueueCandidate[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState("All")
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "")
  const [section, setSection] = useState<DetailSection>("evidence")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const savedFilter = localStorage.getItem("review-filter")
    const savedSelection = localStorage.getItem("review-selection")
    if (savedFilter) setFilter(savedFilter)
    if (savedSelection && candidates.some((item) => item.id === savedSelection)) {
      setSelectedId(savedSelection)
    }
  }, [candidates])

  const visible = useMemo(
    () =>
      filter === "All"
        ? candidates
        : candidates.filter((candidate) => candidate.reviewStatus === filter),
    [candidates, filter],
  )
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? visible[0]

  const persistFilter = (value: string) => {
    setFilter(value)
    localStorage.setItem("review-filter", value)
  }
  const select = (id: string) => {
    setSelectedId(id)
    localStorage.setItem("review-selection", id)
  }

  /** Re-renders the server component that reads SQLite, rather than reloading the whole document. */
  const refresh = () => router.refresh()

  const post = async (
    event: React.FormEvent<HTMLFormElement>,
    path: string,
    body: Record<string, unknown>,
    success: string,
  ) => {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setMessage(result.error ?? "Could not save.")
        return
      }
      setMessage(success)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>, success: string) => {
    if (!selected) return
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    void post(event, `/api/review/${selected.id}`, body, success)
  }

  const suppress = (event: React.FormEvent<HTMLFormElement>) => {
    if (!selected) return
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "")
    void post(
      event,
      `/api/review/${selected.id}/suppress`,
      { reason },
      "Suppressed for every future run.",
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)] lg:items-start">
      <CandidateList
        candidates={visible}
        filter={filter}
        selectedId={selected?.id}
        onFilter={persistFilter}
        onSelect={select}
      />

      {selected ? (
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {selected.locality}
                </span>
                <span>·</span>
                <span>{humanizeTerm(selected.primaryOpportunity)}</span>
                <span>·</span>
                <span>
                  {selected.contactAvailable ? "Contact Route Available" : "No Contact Route"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CandidateStatusBadge status={selected.reviewStatus} />
                <span className="text-sm text-muted-foreground">
                  Score{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatScore(selected.score)}
                  </span>
                </span>
              </div>

              <fieldset className="flex items-center gap-0.5 rounded-lg border p-0.5">
                <legend className="sr-only">Candidate Section</legend>
                {sections.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "relative cursor-pointer rounded-md px-2.5 py-1 text-sm transition-colors",
                      "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      section === option.value
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="candidate-section"
                      value={option.value}
                      checked={section === option.value}
                      onChange={() => setSection(option.value)}
                      className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </CardContent>
          </Card>

          {message ? (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}

          {section === "evidence" ? <CandidateEvidence candidate={selected} /> : null}
          {section === "decision" ? (
            <CandidateDecision
              candidate={selected}
              busy={busy}
              onSubmit={(event) => submitForm(event, "Review saved.")}
            />
          ) : null}
          {section === "history" ? (
            <CandidateHistory
              candidate={selected}
              busy={busy}
              onCorrect={(event) => submitForm(event, "Correction added.")}
              onSuppress={suppress}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
