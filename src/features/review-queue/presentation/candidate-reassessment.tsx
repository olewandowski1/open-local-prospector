"use client"

import { RefreshIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useState } from "react"

import { Icon } from "@/components/icon"
import { SectionHeader } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { SCORE_RUBRIC_VERSION } from "@/features/review-queue/domain/opportunity-score"

export function CandidateReassessment({
  candidate,
  busy,
  onReassess,
}: {
  candidate: Readonly<{ id: string; rubricVersion: string; inspectionState: string }>
  busy: boolean
  onReassess: () => Promise<string | undefined>
}) {
  const [startedRunId, setStartedRunId] = useState<string>()
  const staleRubric = candidate.rubricVersion !== SCORE_RUBRIC_VERSION
  const unseenWebsite = candidate.inspectionState === "Blocked"

  return (
    <section aria-labelledby="reassessment-heading" className="flex flex-col gap-4">
      <SectionHeader
        title={<span id="reassessment-heading">Reassessment</span>}
        description="Observe this business again and score it from what is seen now. Earlier findings are kept."
      />
      <div className="rounded-lg border">
        <div className="flex flex-col items-start gap-3 p-4 @sm:flex-row @sm:items-center @sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-medium">Reassess Business</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              {startedRunId
                ? "The run inspects the website again, then assesses and scores it."
                : reason({ staleRubric, unseenWebsite })}
            </p>
          </div>
          <div className="shrink-0">
            {startedRunId ? (
              <p className="text-sm">
                Run{" "}
                <span className="font-medium tabular-nums" title={startedRunId}>
                  #{startedRunId.slice(0, 8)}
                </span>{" "}
                started. <Link href={`/runs/${startedRunId}`}>View Progress</Link>.
              </p>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  const runId = await onReassess()
                  if (runId) setStartedRunId(runId)
                }}
              >
                <Icon icon={RefreshIcon} data-icon="inline-start" />
                Reassess Business
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// Say why this candidate is worth observing again, so the action is not a button without a reason.
function reason(state: Readonly<{ staleRubric: boolean; unseenWebsite: boolean }>): string {
  const cause = state.unseenWebsite
    ? "This score was reached without a page being captured. "
    : state.staleRubric
      ? "This score predates the current rubric. "
      : ""
  return `${cause}Reassessment verifies contact routes, inspects the website again, then assesses and scores it. It uses your subscription runtime and fetches the public website.`
}
