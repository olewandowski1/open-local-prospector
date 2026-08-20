"use client"

import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { CORRECTION_TARGETS } from "@/features/review-queue/domain/review-policy"
import {
  formatObservedAt,
  humanizeTerm,
} from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

const fieldSpacing = "gap-1.5"

export function CandidateHistory({
  candidate,
  busy,
  onCorrect,
  onSuppress,
  onDeleteBusiness,
}: {
  candidate: QueueCandidate
  busy: boolean
  onCorrect: (event: React.FormEvent<HTMLFormElement>) => void
  onSuppress: (event: React.FormEvent<HTMLFormElement>) => void
  onDeleteBusiness: (confirmation: string) => Promise<boolean>
}) {
  const [confirmation, setConfirmation] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Correction History
          </CardTitle>
          <CardDescription>
            Corrections are appended. The original machine assessment stays immutable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidate.corrections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No corrections recorded.</p>
          ) : (
            <ul className="grid gap-3">
              {candidate.corrections.map((correction) => (
                <li
                  key={`${correction.createdAt}-${correction.target}`}
                  className="border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{humanizeTerm(correction.target)}</Badge>
                    <time className="text-xs text-muted-foreground">
                      {formatObservedAt(correction.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1.5 text-pretty">{correction.correctedValue}</p>
                  {correction.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{correction.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <Separator />
        <div>
          <h2 className="font-heading font-medium">Delete Business</h2>
          <p className="text-sm text-muted-foreground">
            Remove this business, its assessments, notes and artifacts. A minimal suppression is
            retained so it is not rediscovered.
          </p>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete Business
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {candidate.name}</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the stored business and its evidence. The suppression entry
                is the only record kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field className={fieldSpacing}>
              <FieldLabel htmlFor={`delete-business-${candidate.id}`}>
                Type DELETE To Confirm
              </FieldLabel>
              <Input
                id={`delete-business-${candidate.id}`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy || confirmation !== "DELETE"}
                onClick={() =>
                  void onDeleteBusiness(confirmation).then(
                    (deleted) => deleted && setDeleteOpen(false),
                  )
                }
              >
                Delete Business
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Add Correction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onCorrect}>
            <input type="hidden" name="kind" value="correction" />
            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="target">Correction Target</FieldLabel>
              <Select name="target" defaultValue="SupportingObservation">
                <SelectTrigger id="target" aria-label="Correction Target" className="w-full">
                  <SelectValue />
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Do Not Contact
          </CardTitle>
          <CardDescription>
            Suppression prevents future recommendation, reassessment for outreach, and export. It
            does not contact anyone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSuppress}>
            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="suppressionReason">Suppression Reason</FieldLabel>
              <Input id="suppressionReason" name="reason" required />
              <FieldDescription>Applies to this business across every future run.</FieldDescription>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="destructive" disabled={busy}>
                Suppress Globally
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
