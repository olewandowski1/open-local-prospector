"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { REJECTION_REASONS, REVIEW_STATUSES } from "@/features/review-queue/domain/review-policy"
import { humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

const fieldSpacing = "gap-1.5"

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
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Decision
        </CardTitle>
        <CardDescription>
          Recorded alongside the machine assessment, never replacing it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <input type="hidden" name="kind" value="review" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="status">Review Status</FieldLabel>
              <Select name="status" defaultValue={candidate.reviewStatus}>
                <SelectTrigger id="status" aria-label="Review Status" className="w-full">
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

            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="rejectionReason">Rejection Reason</FieldLabel>
              <Select name="rejectionReason" defaultValue={candidate.rejectionReason}>
                <SelectTrigger
                  id="rejectionReason"
                  aria-label="Rejection Reason"
                  className="w-full"
                >
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REJECTION_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {humanizeTerm(reason)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Required when the status is Rejected.</FieldDescription>
            </Field>
          </div>

          <Field className={fieldSpacing}>
            <FieldLabel htmlFor="rejectionNote">Rejection Note</FieldLabel>
            <Input id="rejectionNote" name="rejectionNote" defaultValue={candidate.rejectionNote} />
          </Field>

          <Field className={fieldSpacing}>
            <FieldLabel htmlFor="privateNotes">Private Review Notes</FieldLabel>
            <Textarea id="privateNotes" name="privateNotes" defaultValue={candidate.privateNotes} />
            <FieldDescription>Stored locally and never sent anywhere.</FieldDescription>
          </Field>

          <Field className={fieldSpacing}>
            <FieldLabel htmlFor="followUpAt">Follow-Up Date</FieldLabel>
            <Input
              id="followUpAt"
              name="followUpAt"
              type="date"
              defaultValue={candidate.followUpAt}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              Save Review
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
