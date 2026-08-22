"use client"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

// The write replaces every column it is given, so the status and rejection fields are sent back unchanged.
export function CandidateDecision({
  candidate,
  busy,
  onSubmit,
}: {
  candidate: QueueCandidate
  busy: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section aria-labelledby="candidate-notes-heading" className="grid gap-6">
      <Separator />
      <div>
        <h2 id="candidate-notes-heading" className="font-heading text-base font-semibold">
          Notes And Follow-Up
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Stored locally beside the machine assessment, never replacing it.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <input type="hidden" name="kind" value="review" />
        <input type="hidden" name="status" value={candidate.reviewStatus} />
        <input type="hidden" name="rejectionReason" value={candidate.rejectionReason ?? ""} />
        <input type="hidden" name="rejectionNote" value={candidate.rejectionNote ?? ""} />

        <FieldGroup className="gap-3">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="privateNotes">Private Review Notes</FieldLabel>
            <Textarea id="privateNotes" name="privateNotes" defaultValue={candidate.privateNotes} />
            <FieldDescription>Stored locally and never sent anywhere.</FieldDescription>
          </Field>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field className="w-48 gap-1.5">
              <FieldLabel htmlFor="followUpAt">Follow-Up Date</FieldLabel>
              <Input
                id="followUpAt"
                name="followUpAt"
                type="date"
                defaultValue={candidate.followUpAt}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={busy}>
              Save Notes
            </Button>
          </div>
        </FieldGroup>
      </form>
    </section>
  )
}
