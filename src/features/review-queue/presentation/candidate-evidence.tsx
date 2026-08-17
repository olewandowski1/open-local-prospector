"use client"

import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  displayUrl,
  formatObservedAt,
  formatScore,
  groupPresences,
  humanizeTerm,
  scoreComponents,
} from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

export function CandidateEvidence({ candidate }: { candidate: QueueCandidate }) {
  const components = scoreComponents(candidate)
  const presences = groupPresences(candidate.presences)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Score Explanation
          </CardTitle>
          <CardDescription>
            Deterministic rubric {candidate.rubricVersion}. The machine assessment is never
            overwritten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2.5">
            {components.map((component) => (
              <div key={component.label} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="text-muted-foreground">{component.label}</dt>
                  <dd className="tabular-nums">
                    <span className="font-medium">{formatScore(component.value)}</span>
                    <span className="text-muted-foreground"> / {component.max}</span>
                  </dd>
                </div>
                <Progress value={(component.value / component.max) * 100} />
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {candidate.opportunities.map((opportunity) => (
            <div key={`${opportunity.opportunityClass}-${opportunity.explanation}`}>
              <Badge variant="secondary">
                {humanizeTerm(opportunity.opportunityClass)} · Severity {opportunity.severity}
              </Badge>
              <p className="mt-1.5 text-sm text-pretty">{opportunity.explanation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Supporting Evidence
          </CardTitle>
          <CardDescription>
            Every statement carries the public source it was observed on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {candidate.observations.map((observation) => (
              <li
                key={`${observation.sourceUrl}-${observation.statement}`}
                className="border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{humanizeTerm(observation.evidenceState)}</Badge>
                  <time className="text-xs text-muted-foreground">
                    {formatObservedAt(observation.observedAt)}
                  </time>
                </div>
                <p className="mt-1.5 text-pretty">{observation.statement}</p>
                <SourceLink url={observation.sourceUrl} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Online Presence and Contact
          </CardTitle>
          <CardDescription>
            Inspection state {humanizeTerm(candidate.inspectionState)}
            {candidate.limitations.length > 0
              ? ` · Limitations: ${candidate.limitations.map(humanizeTerm).join(", ")}`
              : " · No recorded limitations"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {candidate.contacts.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Contact Routes</h3>
              <ul className="mt-1.5 grid gap-1 text-sm">
                {candidate.contacts.map((contact) => (
                  <li key={`${contact.type}-${contact.value}`}>
                    <span className="text-muted-foreground">{humanizeTerm(contact.type)}: </span>
                    {contact.value}
                    <SourceLink url={contact.sourceUrl} label="Source" inline />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {presences.map((group) => (
            <div key={group.type}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {humanizeTerm(group.type)} ({group.urls.length})
              </h3>
              <ul className="mt-1.5 grid gap-1">
                {group.urls.map((url) => (
                  <li key={url} className="min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title={url}
                      className="block truncate text-sm underline underline-offset-4"
                    >
                      {displayUrl(url)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {candidate.measurements.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Measurements</h3>
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                {candidate.measurements.join(" · ")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function SourceLink({
  url,
  label = "View Source",
  inline = false,
}: {
  url: string
  label?: string
  inline?: boolean
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className={
        inline
          ? "ml-1.5 text-xs text-muted-foreground underline underline-offset-4"
          : "mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
      }
    >
      {label}
      {inline ? null : <ExternalLink aria-hidden="true" className="size-3" />}
    </a>
  )
}
