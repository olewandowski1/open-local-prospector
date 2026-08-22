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
  token: string
  trigger: ReactElement
  busyLabel: string
  confirmLabel: string
  pending: boolean
  onConfirm: (confirmation: string) => Promise<boolean>
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
