"use client"

import { FormFieldLabel } from "@/components/form-field-label"
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { CORRECTION_TARGETS } from "@/features/review-queue/domain/review-policy"
import {
  formatObservedAt,
  humanizeTerm,
} from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

const fieldSpacing = "gap-1"

/**
 * Everything a reader reaches for after deciding rather than before. Collapsed by default so the
 * evidence is what the panel shows; each trigger says what is inside so nothing is hidden by it.
 */
export function CandidateAdmin({
  candidate,
  busy,
  onSaveReview,
  onCorrect,
}: {
  candidate: QueueCandidate
  busy: boolean
  onSaveReview: (event: React.FormEvent<HTMLFormElement>) => void
  onCorrect: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const noted = candidate.privateNotes.trim() !== "" || candidate.followUpAt !== undefined

  return (
    <Accordion className="rounded-lg border px-3">
      <AccordionItem value="notes">
        <AccordionTrigger>
          Notes And Follow-Up
          <TriggerHint>{noted ? "Recorded" : "Empty"}</TriggerHint>
        </AccordionTrigger>
        <AccordionPanel>
          <p className="mb-3 text-sm text-muted-foreground">
            Stored locally beside the machine assessment, never replacing it.
          </p>
          {/* The write replaces every column it is given, so the decision fields go back unchanged. */}
          <form onSubmit={onSaveReview}>
            <input type="hidden" name="kind" value="review" />
            <input type="hidden" name="status" value={candidate.reviewStatus} />
            <input type="hidden" name="rejectionReason" value={candidate.rejectionReason ?? ""} />
            <input type="hidden" name="rejectionNote" value={candidate.rejectionNote ?? ""} />

            <FieldGroup className="gap-3">
              <Field className={fieldSpacing}>
                <FormFieldLabel
                  htmlFor="privateNotes"
                  label="Private Review Notes"
                  description="Stored locally and never sent anywhere."
                />
                <Textarea
                  id="privateNotes"
                  name="privateNotes"
                  defaultValue={candidate.privateNotes}
                />
              </Field>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field className={`w-48 ${fieldSpacing}`}>
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
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="correction">
        <AccordionTrigger>
          Add Correction
          <TriggerHint>Appends, never overwrites</TriggerHint>
        </AccordionTrigger>
        <AccordionPanel>
          <form onSubmit={onCorrect}>
            <input type="hidden" name="kind" value="correction" />
            <FieldGroup className="gap-4">
              <Field className={fieldSpacing}>
                <FieldLabel htmlFor="target">Correction Target</FieldLabel>
                <Select name="target" defaultValue="SupportingObservation">
                  <SelectTrigger id="target" aria-label="Correction Target" className="w-full">
                    {/* The stored value is `SupportingObservation`; the trigger must not say that. */}
                    <SelectValue>{(target: string) => humanizeTerm(target)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CORRECTION_TARGETS.map((target) => (
                        <SelectItem key={target} value={target}>
                          {humanizeTerm(target)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className={fieldSpacing}>
                <FieldLabel htmlFor="correctedValue">Corrected Value</FieldLabel>
                <Textarea id="correctedValue" name="correctedValue" required />
              </Field>
              <Field className={fieldSpacing}>
                <FieldLabel htmlFor="correctionNote">Reason</FieldLabel>
                <Input id="correctionNote" name="note" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={busy}>
                  Add Correction
                </Button>
              </div>
            </FieldGroup>
          </form>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="history">
        <AccordionTrigger>
          Correction History
          <TriggerHint>
            {candidate.corrections.length === 0
              ? "None"
              : `${candidate.corrections.length} recorded`}
          </TriggerHint>
        </AccordionTrigger>
        <AccordionPanel>
          {candidate.corrections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No corrections recorded. The original machine assessment stands.
            </p>
          ) : (
            <ul className="grid gap-3">
              {candidate.corrections.map((correction) => (
                <li
                  key={`${correction.createdAt}-${correction.target}`}
                  className="grid gap-1.5 border-b pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm text-pretty">{correction.correctedValue}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium">{humanizeTerm(correction.target)}</span>
                    <span aria-hidden="true">·</span>
                    <time>{formatObservedAt(correction.createdAt)}</time>
                    {correction.note ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{correction.note}</span>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
}

/** What is inside, so a collapsed row still says whether opening it is worth the click. */
function TriggerHint({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-xs font-normal text-muted-foreground">{children}</span>
}
