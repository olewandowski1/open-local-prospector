"use client"

import { Alert01Icon } from "@hugeicons/core-free-icons"
import { useState } from "react"

import { Icon } from "@/components/icon"
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
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

/**
 * The two actions that cannot be taken back, kept together at the foot of the panel so neither is
 * ever the thing a reader's hand lands on while scanning evidence.
 */
export function CandidateDangerZone({
  candidate,
  busy,
  onSuppress,
  onDeleteBusiness,
}: {
  candidate: QueueCandidate
  busy: boolean
  onSuppress: (event: React.FormEvent<HTMLFormElement>) => void
  onDeleteBusiness: (confirmation: string) => Promise<boolean>
}) {
  const [confirmation, setConfirmation] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="grid gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <header className="flex items-center gap-2">
        <Icon icon={Alert01Icon} className="size-4 text-destructive" />
        <h2
          id="danger-zone-heading"
          className="font-heading text-sm font-semibold text-destructive"
        >
          Danger Zone
        </h2>
      </header>

      <DangerRow
        title="Do Not Contact"
        description="Suppression prevents future recommendation, reassessment for outreach, and export. It does not contact anyone."
      >
        <form onSubmit={onSuppress} className="grid gap-2">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="suppressionReason">Suppression Reason</FieldLabel>
            <Input id="suppressionReason" name="reason" required />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="destructive" size="sm" disabled={busy}>
              Suppress Globally
            </Button>
          </div>
        </form>
      </DangerRow>

      <DangerRow
        title="Delete Business"
        description="Removes this business, its assessments, notes and artifacts. A later run may find it again; to keep it out for good, suppress it instead."
      >
        <div className="flex justify-end">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
              Delete Business
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {candidate.name}</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the stored business and its evidence. Nothing is kept, so
                  a later run may discover it again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field className="gap-1.5">
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
        </div>
      </DangerRow>
    </section>
  )
}

function DangerRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-destructive/25 bg-background p-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
