"use client"

import type { ReactElement, ReactNode } from "react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * An irreversible workspace action, held behind a word the operator has to type.
 *
 * Each of these used to be written out where it was used, so the page carried a parallel `open` and
 * `confirmation` pair per action and every keystroke in any of them re-rendered all of them. Keeping
 * that state here means one action's dialog knows nothing about the others.
 */
export function ConfirmedAction({
  title,
  description,
  token,
  trigger,
  busyLabel,
  confirmLabel,
  pending,
  onConfirm,
  children,
}: {
  title: string
  description: ReactNode
  /** The word that must be typed exactly, and the word the field asks for. */
  token: string
  trigger: ReactElement
  busyLabel: string
  confirmLabel: string
  pending: boolean
  /** Resolves true when the action succeeded, which is when the dialog closes. */
  onConfirm: (confirmation: string) => Promise<boolean>
  /** Anything shown between the description and the confirmation field. */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const fieldId = `confirm-${token.toLocaleLowerCase("en")}`

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) setConfirmation("")
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId}>Type {token} To Confirm</FieldLabel>
            <Input
              id={fieldId}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || confirmation !== token}
            onClick={() => {
              void onConfirm(confirmation).then((done) => done && changeOpen(false))
            }}
          >
            {pending ? busyLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
