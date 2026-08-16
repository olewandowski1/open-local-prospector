"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  CORRECTION_TARGETS,
  REJECTION_REASONS,
  REVIEW_STATUSES,
} from "@/features/review-queue/domain/review-policy"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

export function ReviewWorkspace({ candidates }: { candidates: readonly QueueCandidate[] }) {
  const [filter, setFilter] = useState("All")
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "")
  useEffect(() => {
    const savedFilter = localStorage.getItem("review-filter")
    const savedSelection = localStorage.getItem("review-selection")
    if (savedFilter) setFilter(savedFilter)
    if (savedSelection && candidates.some((item) => item.id === savedSelection))
      setSelectedId(savedSelection)
  }, [candidates])
  const visible = useMemo(
    () =>
      filter === "All"
        ? candidates
        : candidates.filter((candidate) => candidate.reviewStatus === filter),
    [candidates, filter],
  )
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? visible[0]
  const persistFilter = (value: string | null) => {
    const next = value ?? "All"
    setFilter(next)
    localStorage.setItem("review-filter", next)
  }
  const select = (id: string) => {
    setSelectedId(id)
    localStorage.setItem("review-selection", id)
  }
  const exportQuery = filter === "All" ? "" : `&status=${encodeURIComponent(filter)}`
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Ranked candidates</CardTitle>
          <CardDescription>Selection and filter persist on this device.</CardDescription>
          <Select value={filter} onValueChange={persistFilter}>
            <SelectTrigger aria-label="Review status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="All">All statuses</SelectItem>
                {REVIEW_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
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
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {visible.map((candidate) => (
              <li key={candidate.id}>
                <Button
                  variant={selected?.id === candidate.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-between"
                  onClick={() => select(candidate.id)}
                >
                  <span className="text-left">
                    <span className="block font-medium">{candidate.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {candidate.locality} · {candidate.primaryOpportunity}
                    </span>
                  </span>
                  <span className="tabular-nums">{candidate.score}</span>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {selected ? <CandidateDetail candidate={selected} /> : null}
    </div>
  )
}

function CandidateDetail({ candidate }: { candidate: QueueCandidate }) {
  const [message, setMessage] = useState("")
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    const response = await fetch(`/api/review/${candidate.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = (await response.json()) as { error?: string }
    setMessage(response.ok ? "Saved. Refreshing…" : (result.error ?? "Could not save."))
    if (response.ok) location.reload()
  }
  async function suppress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "")
    const response = await fetch(`/api/review/${candidate.id}/suppress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    setMessage(response.ok ? "Suppressed globally. Refreshing…" : "Suppression failed.")
    if (response.ok) location.reload()
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{candidate.name}</CardTitle>
        <CardDescription>
          {candidate.locality} · score {candidate.score} · {candidate.rubricVersion}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section>
          <h2 className="font-medium">Score explanation</h2>
          <p className="text-sm text-muted-foreground">
            Severity {candidate.breakdown.severity}, confidence {candidate.breakdown.confidence},
            contact {candidate.breakdown.contact}, local decision{" "}
            {candidate.breakdown.localDecision}, commercial value{" "}
            {candidate.breakdown.commercialValue}.
          </p>
        </section>
        <Separator />
        <section>
          <h2 className="font-medium">Opportunities and evidence</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {candidate.opportunities.map((opportunity) => (
              <li key={`${opportunity.opportunityClass}-${opportunity.explanation}`}>
                <Badge variant="secondary">
                  {opportunity.opportunityClass} · severity {opportunity.severity}
                </Badge>
                <p className="mt-1 text-sm">{opportunity.explanation}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-col gap-2">
            {candidate.observations.map((observation) => (
              <li key={`${observation.sourceUrl}-${observation.statement}`} className="text-sm">
                <Badge variant="outline">{observation.evidenceState}</Badge> {observation.statement}{" "}
                <a
                  className="underline"
                  href={observation.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source
                </a>{" "}
                <span className="text-muted-foreground">{observation.observedAt}</span>
              </li>
            ))}
          </ul>
        </section>
        <Separator />
        <section>
          <h2 className="font-medium">Inspection and online presence</h2>
          <p className="text-sm text-muted-foreground">
            State: {candidate.inspectionState}; limitations:{" "}
            {candidate.limitations.join(", ") || "none recorded"}
          </p>
          <p className="mt-2 text-sm">
            Measurements: {candidate.measurements.join(" · ") || "none"}
          </p>
          <ul className="mt-2">
            {candidate.presences.map((presence) => (
              <li key={presence.url} className="text-sm">
                {presence.type}:{" "}
                <a className="underline" href={presence.url} target="_blank" rel="noreferrer">
                  {presence.url}
                </a>
              </li>
            ))}
          </ul>
          <ul className="mt-2">
            {candidate.contacts.map((contact) => (
              <li key={`${contact.type}-${contact.value}`} className="text-sm">
                {contact.type}: {contact.value} (
                <a className="underline" href={contact.sourceUrl} target="_blank" rel="noreferrer">
                  source
                </a>
                )
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Screenshots: {candidate.screenshots.join(", ") || "none"}
          </p>
        </section>
        <Separator />
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <input type="hidden" name="kind" value="review" />
          <FieldGroup>
            <Field>
              <FieldLabel>Review status</FieldLabel>
              <Select name="status" defaultValue={candidate.reviewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REVIEW_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rejectionReason">
                Rejection reason (required when rejected)
              </FieldLabel>
              <Select name="rejectionReason" defaultValue={candidate.rejectionReason}>
                <SelectTrigger id="rejectionReason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REJECTION_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rejectionNote">Rejection note</FieldLabel>
              <Input
                id="rejectionNote"
                name="rejectionNote"
                defaultValue={candidate.rejectionNote}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="privateNotes">Private review notes</FieldLabel>
              <Textarea
                id="privateNotes"
                name="privateNotes"
                defaultValue={candidate.privateNotes}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="followUpAt">Optional follow-up date</FieldLabel>
              <Input
                id="followUpAt"
                name="followUpAt"
                type="date"
                defaultValue={candidate.followUpAt}
              />
            </Field>
          </FieldGroup>
          <Button type="submit">Save review</Button>
        </form>
        <Separator />
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <input type="hidden" name="kind" value="correction" />
          <FieldGroup>
            <Field>
              <FieldLabel>Correction target</FieldLabel>
              <Select name="target" defaultValue="SupportingObservation">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CORRECTION_TARGETS.map((target) => (
                      <SelectItem key={target} value={target}>
                        {target}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="correctedValue">Corrected value</FieldLabel>
              <Textarea id="correctedValue" name="correctedValue" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="correctionNote">Reason</FieldLabel>
              <Input id="correctionNote" name="note" />
            </Field>
          </FieldGroup>
          <Button type="submit" variant="outline">
            Add correction
          </Button>
        </form>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
        <section>
          <h2 className="font-medium">Correction history</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {candidate.corrections.map((correction) => (
              <li key={`${correction.createdAt}-${correction.target}`} className="text-sm">
                <Badge variant="outline">{correction.target}</Badge> {correction.correctedValue}{" "}
                <span className="text-muted-foreground">{correction.createdAt}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Original machine assessment remains immutable.
          </p>
        </section>
        <Separator />
        <form className="flex flex-col gap-3" onSubmit={suppress}>
          <Field>
            <FieldLabel htmlFor="suppressionReason">Do not contact reason</FieldLabel>
            <Input id="suppressionReason" name="reason" required />
          </Field>
          <Button type="submit" variant="destructive">
            Suppress globally
          </Button>
          <p className="text-xs text-muted-foreground">
            Prevents future recommendation, reassessment for outreach, and export. It does not
            contact anyone.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
