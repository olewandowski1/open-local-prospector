"use client"

import {
  ArchiveRestoreIcon,
  DatabaseBackupIcon,
  DatabaseRestoreIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  formatBytes,
  formatCount,
  type WorkspaceInventory,
} from "@/features/workspace-administration/client"

export function WorkspaceActions({ inventory }: { inventory: WorkspaceInventory }) {
  const router = useRouter()
  const [resetOpen, setResetOpen] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState("")
  const [cleanupConfirmation, setCleanupConfirmation] = useState("")
  const [restoreConfirmation, setRestoreConfirmation] = useState("")
  const [restoreFile, setRestoreFile] = useState<File>()
  const [pending, setPending] = useState<"reset" | "restore" | "compact" | "cleanup">()
  const [feedback, setFeedback] = useState<{
    title: string
    description: string
    destructive?: boolean
  }>()
  const fileInput = useRef<HTMLInputElement>(null)

  const runAction = async (
    action: "reset" | "restore" | "compact" | "cleanup",
    request: () => Promise<Response>,
  ) => {
    setPending(action)
    setFeedback(undefined)
    try {
      const response = await request()
      const body = (await response.json()) as Record<string, unknown>
      if (!response.ok)
        throw new Error(typeof body.error === "string" ? body.error : "The action failed.")
      if (action === "reset") {
        setResetOpen(false)
        setResetConfirmation("")
        const leftoverFiles = Number(body.leftoverFiles ?? 0)
        setFeedback({
          title: "Workspace Reset",
          description:
            leftoverFiles > 0
              ? `${leftoverFiles} artifact files could not be removed. Their paths remain under the artifacts directory.`
              : "Prospecting data and artifacts were removed. Preferences and suppressions were kept.",
        })
      } else if (action === "restore") {
        setRestoreOpen(false)
        setRestoreConfirmation("")
        setRestoreFile(undefined)
        if (fileInput.current) fileInput.current.value = ""
        setFeedback({
          title: "Workspace Restored",
          description:
            typeof body.recoveryBackupPath === "string"
              ? `The previous workspace was saved to ${body.recoveryBackupPath}.`
              : "The backup replaced the workspace successfully.",
        })
      } else if (action === "compact") {
        setFeedback({
          title: "Database Compacted",
          description: `${formatBytes(Number(body.beforeBytes))} → ${formatBytes(Number(body.afterBytes))}`,
        })
      } else {
        setCleanupOpen(false)
        setCleanupConfirmation("")
        setFeedback({
          title: "Artifacts Cleaned Up",
          description: `${formatCount(Number(body.removedFiles ?? 0))} archived or orphaned files removed.`,
        })
      }
      router.refresh()
    } catch (error) {
      setFeedback({
        title: "Action Not Completed",
        description: error instanceof Error ? error.message : "The action failed.",
        destructive: true,
      })
    } finally {
      setPending(undefined)
    }
  }

  return (
    <section aria-labelledby="workspace-actions-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="workspace-actions-heading" className="font-heading text-lg font-semibold">
          Backup And Maintenance
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Backups include the database, artifacts and non-secret configuration. A snapshot taken
          during a run records the workspace at that moment; it does not pause the run.
        </p>
      </div>

      {feedback ? (
        <Alert variant={feedback.destructive ? "destructive" : "default"}>
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <ActionRow
          title="Download Backup"
          description="Keep a restorable copy of this workspace."
          action={
            <a href="/api/workspace/backup" className={buttonVariants({ variant: "outline" })}>
              <HugeiconsIcon icon={DatabaseBackupIcon} data-icon="inline-start" />
              Download Backup
            </a>
          }
        />

        <ActionRow
          title="Restore Backup"
          description="Validate and replace this workspace from an application backup."
          action={
            <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                <HugeiconsIcon icon={ArchiveRestoreIcon} data-icon="inline-start" />
                Restore Backup
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restore Workspace</DialogTitle>
                  <DialogDescription>
                    The archive is validated before replacement. Active runs block restore, and a
                    recovery backup of the current workspace is created automatically.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="workspace-backup">Workspace Backup</FieldLabel>
                    <Input
                      ref={fileInput}
                      id="workspace-backup"
                      type="file"
                      accept=".tgz,.olp-backup.tgz,application/gzip"
                      onChange={(event) => setRestoreFile(event.target.files?.[0])}
                    />
                    <FieldDescription>
                      Select a backup downloaded from this application.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="restore-confirmation">Type RESTORE To Confirm</FieldLabel>
                    <Input
                      id="restore-confirmation"
                      value={restoreConfirmation}
                      onChange={(event) => setRestoreConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter layout="stretch">
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button
                    variant="warning"
                    disabled={
                      pending === "restore" || restoreConfirmation !== "RESTORE" || !restoreFile
                    }
                    onClick={() => {
                      if (!restoreFile) return
                      void runAction("restore", () =>
                        fetch("/api/workspace/restore", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/octet-stream",
                            "X-Workspace-Confirmation": restoreConfirmation,
                          },
                          body: restoreFile,
                        }),
                      )
                    }}
                  >
                    <HugeiconsIcon icon={DatabaseRestoreIcon} data-icon="inline-start" />
                    {pending === "restore" ? "Restoring…" : "Restore Workspace"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <ActionRow
          title="Compact Database"
          description="Return SQLite pages freed by deleted data to the filesystem."
          action={
            <Button
              variant="outline"
              disabled={pending === "compact"}
              onClick={() =>
                void runAction("compact", () => fetch("/api/workspace/compact", { method: "POST" }))
              }
            >
              <HugeiconsIcon icon={DatabaseRestoreIcon} data-icon="inline-start" />
              {pending === "compact" ? "Compacting…" : "Compact Database"}
            </Button>
          }
        />

        <ActionRow
          title="Clean Up Artifacts"
          description="Remove screenshots for archived candidates and files no database record still uses."
          action={
            <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                Clean Up
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clean Up Artifacts</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes archived candidate screenshots and orphaned files. It
                    refuses to run while prospecting is active.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="cleanup-confirmation">Type CLEANUP To Confirm</FieldLabel>
                    <Input
                      id="cleanup-confirmation"
                      value={cleanupConfirmation}
                      onChange={(event) => setCleanupConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                </FieldGroup>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={pending === "cleanup" || cleanupConfirmation !== "CLEANUP"}
                    onClick={() =>
                      void runAction("cleanup", () =>
                        fetch("/api/workspace/cleanup", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ confirmation: cleanupConfirmation }),
                        }),
                      )
                    }
                  >
                    {pending === "cleanup" ? "Cleaning Up…" : "Clean Up Artifacts"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />

        <ActionRow
          title="Reset Workspace"
          description="Delete prospecting results and artifacts while keeping preferences and suppressions."
          action={
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
                Reset Workspace
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes {formatCount(inventory.runs)} runs,{" "}
                    {formatCount(inventory.discoveredBusinesses)} discovered businesses and{" "}
                    {formatCount(inventory.artifactCount)} artifact files. Preferences, geocoding
                    cache and suppressions remain.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Alert variant="destructive">
                  <HugeiconsIcon icon={DatabaseBackupIcon} aria-hidden="true" />
                  <AlertTitle>Keep A Copy First</AlertTitle>
                  <AlertDescription>
                    <a href="/api/workspace/backup">Download A Workspace Backup</a> before resetting
                    if any of this data may be needed again.
                  </AlertDescription>
                </Alert>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="reset-confirmation">Type RESET To Confirm</FieldLabel>
                    <Input
                      id="reset-confirmation"
                      value={resetConfirmation}
                      onChange={(event) => setResetConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                </FieldGroup>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={pending === "reset" || resetConfirmation !== "RESET"}
                    onClick={() =>
                      void runAction("reset", () =>
                        fetch("/api/workspace/reset", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ confirmation: resetConfirmation }),
                        }),
                      )
                    }
                  >
                    <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
                    {pending === "reset" ? "Resetting…" : "Reset Workspace"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>
    </section>
  )
}

function ActionRow({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 border-b p-4 last:border-b-0 @sm:flex-row @sm:items-center @sm:justify-between">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
