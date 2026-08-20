"use client"

import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { IconButton } from "@/components/icon-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatCount } from "@/features/workspace-administration/client"

type DeletionPreview = Readonly<{
  discoveredBusinesses: number
  candidateBusinesses: number
  evidenceArtifacts: number
  sharedCanonicalBusinesses: number
}>

export function RunDeleteDialog({
  runId,
  runLabel,
  afterDelete = "/runs",
}: {
  runId: string
  runLabel: string
  afterDelete?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const [deleted, setDeleted] = useState(false)
  const [preview, setPreview] = useState<DeletionPreview>()

  const remove = async () => {
    setPending(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
        method: "DELETE",
        headers: { "X-Workspace-Confirmation": confirmation },
      })
      const body = (await response.json()) as { error?: string; leftoverFiles?: number }
      if (!response.ok) throw new Error(body.error ?? "The run was not deleted.")
      if ((body.leftoverFiles ?? 0) > 0) {
        setDeleted(true)
        setError(
          `The run was deleted, but ${body.leftoverFiles} artifact ${body.leftoverFiles === 1 ? "file remains" : "files remain"} on disk. Check the Data cleanup tools.`,
        )
        return
      }
      setOpen(false)
      router.push(afterDelete)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "The action failed.")
    } finally {
      setPending(false)
    }
  }

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen && deleted) {
      router.push(afterDelete)
      router.refresh()
      return
    }
    if (!nextOpen) {
      setPreviewError(undefined)
      return
    }
    if (preview || previewError) return

    void fetch(`/api/runs/${encodeURIComponent(runId)}/deletion-preview`)
      .then(async (response) => {
        if (!response.ok) throw new Error("The run's deletion counts could not be loaded.")
        setPreview(await response.json())
      })
      .catch((error) => {
        setPreviewError(
          error instanceof Error ? error.message : "The run's deletion counts could not be loaded.",
        )
      })
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <IconButton
        label="Delete Run"
        variant="destructive"
        size="icon-sm"
        onClick={() => changeOpen(true)}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </IconButton>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Run</AlertDialogTitle>
          <AlertDialogDescription>
            Delete {runLabel}, its evidence and artifacts. Businesses still used by another run are
            retained. Active and paused runs cannot be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{deleted ? "Some Artifacts Remain" : "Run Not Deleted"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {preview ? (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
            <DeletionCount label="Discovered Businesses" value={preview.discoveredBusinesses} />
            <DeletionCount label="Candidates" value={preview.candidateBusinesses} />
            <DeletionCount label="Artifact Records" value={preview.evidenceArtifacts} />
            <DeletionCount
              label="Shared Businesses Kept"
              value={preview.sharedCanonicalBusinesses}
            />
          </dl>
        ) : previewError ? (
          <Alert variant="destructive">
            <AlertTitle>Counts Unavailable</AlertTitle>
            <AlertDescription>{previewError} Reopen this dialog to try again.</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">Reading the run's deletion counts...</p>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`delete-run-${runId}`}>Type DELETE To Confirm</FieldLabel>
            <Input
              id={`delete-run-${runId}`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>{deleted ? "Close" : "Cancel"}</AlertDialogCancel>
          {deleted ? null : (
            <AlertDialogAction
              variant="destructive"
              disabled={confirmation !== "DELETE" || pending || !preview}
              onClick={() => void remove()}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              {pending ? "Deleting..." : "Delete Run"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeletionCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{formatCount(value)}</dd>
    </div>
  )
}
