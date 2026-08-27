"use client"

import { Alert01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import Image from "next/image"
import { Icon } from "@/components/icon"

import { SectionHeader } from "@/components/page-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  displayUrl,
  formatObservedAt,
  formatScore,
  groupPresences,
  humanizeTerm,
  measurementFacts,
  scoreComponents,
} from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

const SEVERITY_STEPS = [1, 2, 3, 4, 5] as const
const MAX_SEVERITY = SEVERITY_STEPS.length

export function CandidateEvidence({ candidate }: { candidate: QueueCandidate }) {
  const components = scoreComponents(candidate)
  const presences = groupPresences(candidate.presences)

  return (
    <div className="flex flex-col gap-6">
      {candidate.inspectionState === "Blocked" ? (
        <Alert>
          <Icon icon={Alert01Icon} className="text-warning" />
          <AlertTitle>Limited Website Evidence</AlertTitle>
          <AlertDescription>
            {candidate.rubricVersion === "opportunity-score-v2"
              ? "The site blocked inspection before a page was captured. The rubric caps severity at 4 of 5 and confidence at 0.6."
              : "The site blocked inspection before a page was captured. This historical score predates the evidence limits; explicitly reassess this business to apply them."}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="score-explanation-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="score-explanation-heading">Score Explanation</span>}
          description={`Deterministic rubric ${candidate.rubricVersion}. The machine assessment is never overwritten.`}
        />
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
      </section>

      <Separator />
      <section aria-labelledby="opportunities-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="opportunities-heading">Opportunities</span>}
          description="What the assessment found wrong, worst first."
        />
        <ul className="grid divide-y rounded-lg border">
          {candidate.opportunities.map((opportunity) => (
            <li
              key={`${opportunity.opportunityClass}-${opportunity.explanation}`}
              className="grid gap-1.5 p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium">
                  {humanizeTerm(opportunity.opportunityClass)}
                </h3>
                <SeverityMeter severity={opportunity.severity} />
              </div>
              <p className="text-sm text-pretty text-muted-foreground">{opportunity.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <Separator />
      <section aria-labelledby="supporting-evidence-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="supporting-evidence-heading">Supporting Evidence</span>}
          description="Every statement carries the public page it was observed on."
        />
        <ul className="grid divide-y rounded-lg border">
          {candidate.observations.map((observation) => (
            <li
              key={`${observation.sourceUrl}-${observation.statement}`}
              className="grid gap-1.5 p-3"
            >
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-medium">{humanizeTerm(observation.evidenceState)}</h3>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <time>{formatObservedAt(observation.observedAt)}</time>
                  <span aria-hidden="true">·</span>
                  <SourceLink url={observation.sourceUrl} label="Source" />
                </div>
              </div>
              <p className="text-sm text-pretty text-muted-foreground">{observation.statement}</p>
            </li>
          ))}
        </ul>
      </section>

      <Separator />
      <section aria-labelledby="presence-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="presence-heading">Online Presence and Contact</span>}
          description="Where this business is reachable, and what the inspection could see."
        />

        <dl className="grid divide-y rounded-lg border text-sm">
          <Fact label="Inspection State">{humanizeTerm(candidate.inspectionState)}</Fact>
          <Fact label="Limitations">
            {candidate.limitations.length > 0
              ? candidate.limitations.map(humanizeTerm).join(", ")
              : "None recorded"}
          </Fact>
        </dl>

        {candidate.screenshots.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Captured Pages</h3>
            <div className="grid gap-3 @xl:grid-cols-2">
              {candidate.screenshots.map((screenshot) => (
                <figure key={screenshot.id} className="overflow-hidden rounded-lg border">
                  <Image
                    src={`/api/review/${encodeURIComponent(candidate.id)}/screenshots/${encodeURIComponent(screenshot.id)}`}
                    alt={`${humanizeTerm(screenshot.viewport)} website capture for ${candidate.name}`}
                    width={screenshot.viewport === "Mobile" ? 390 : 1440}
                    height={screenshot.viewport === "Mobile" ? 844 : 900}
                    unoptimized
                    className="max-h-80 w-full bg-muted object-contain"
                  />
                  <figcaption className="p-2 text-xs text-muted-foreground">
                    {humanizeTerm(screenshot.viewport)} Capture
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        {candidate.measurements.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Page Measurements</h3>
            <div className="grid gap-3 @xl:grid-cols-2">
              {candidate.measurements.map((measurement) => (
                <div key={measurement.id} className="overflow-hidden rounded-lg border">
                  <h4 className="border-b p-3 text-sm font-medium">
                    {humanizeTerm(measurement.viewport)} Page
                  </h4>
                  <dl className="grid divide-y text-sm">
                    {measurementFacts(measurement.values).map((fact) => (
                      <Fact key={fact.label} label={fact.label}>
                        <span className="tabular-nums">{fact.value}</span>
                      </Fact>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {candidate.contacts.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Contact Routes</h3>
            <ul className="grid divide-y rounded-lg border">
              {candidate.contacts.map((contact) => (
                <li
                  key={`${contact.type}-${contact.value}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {humanizeTerm(contact.type)}
                  </span>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{contact.value}</span>
                    <SourceLink url={contact.sourceUrl} label="Source" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {presences.map((group) => (
          <div key={group.type} className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              {humanizeTerm(group.type)} <span className="tabular-nums">({group.urls.length})</span>
            </h3>
            <ul className="grid divide-y rounded-lg border">
              {group.urls.map((url) => (
                <li key={url} className="min-w-0 p-3">
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
      </section>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

/** Severity is an integer from one to five, so it reads as a position on that scale, not a number. */
function SeverityMeter({ severity }: { severity: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      title={`Severity ${severity} of ${MAX_SEVERITY}`}
    >
      Severity {severity}
      <span aria-hidden="true" className="flex gap-0.5">
        {SEVERITY_STEPS.map((step) => (
          <span
            key={step}
            className={
              step <= severity
                ? "h-1 w-2.5 rounded-full bg-muted-foreground"
                : "h-1 w-2.5 rounded-full bg-border"
            }
          />
        ))}
      </span>
    </span>
  )
}

function SourceLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className="inline-flex min-w-0 shrink-0 items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      <span className="truncate">{label ?? displayUrl(url)}</span>
      <Icon icon={LinkSquare02Icon} className="size-3 shrink-0" />
    </a>
  )
}
