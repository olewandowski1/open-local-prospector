"use client"

import { CircleAlert, CircleCheck, DownloadCloud, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { RuntimeUpdateResult } from "@/features/runtime-settings/application/runtime-update"
import type { RuntimeId, RuntimeReadiness } from "@/features/runtime-settings/client"
import { RuntimeProviderIcon } from "@/features/runtime-settings/client"
import { cn } from "@/lib/utils"

type UpdateState = Readonly<Partial<Record<RuntimeId, RuntimeUpdateResult>>>

/**
 * Runs each provider CLI's own update command. Neither Codex nor Claude exposes a
 * check-without-install mode, so this never claims an update is waiting — it reports what the CLI
 * did, including when it was already current.
 */
export function RuntimeUpdatePanel() {
  const [open, setOpen] = useState(false)
  const [runtimes, setRuntimes] = useState<readonly RuntimeReadiness[]>()
  const [results, setResults] = useState<UpdateState>({})
  const [running, setRunning] = useState<RuntimeId>()
  const installed = runtimes?.filter((runtime) => runtime.status !== "Missing")

  /** Probing spawns provider CLIs, so it happens on open rather than on every page render. */
  const loadRuntimes = async () => {
    setRuntimes(undefined)
    const response = await fetch("/api/runtimes")
    const body = (await response.json().catch(() => null)) as {
      runtimes?: readonly RuntimeReadiness[]
    } | null
    setRuntimes(body?.runtimes ?? [])
  }

  const update = async (runtimeId: RuntimeId) => {
    setRunning(runtimeId)
    try {
      const response = await fetch(`/api/runtimes/${runtimeId}/update`, { method: "POST" })
      const result = (await response.json().catch(() => null)) as RuntimeUpdateResult | null
      setResults((current) => ({
        ...current,
        [runtimeId]: result ?? {
          outcome: "Failed",
          detail: "The update could not be started.",
        },
      }))
    } finally {
      setRunning(undefined)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void loadRuntimes()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Update Runtimes" title="Update Runtimes">
            <DownloadCloud aria-hidden="true" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Runtimes</DialogTitle>
          <DialogDescription>
            Each provider CLI checks for a new release and installs it itself. Nothing is downloaded
            by this application.
          </DialogDescription>
        </DialogHeader>

        {installed === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Checking installed runtimes…
          </p>
        ) : installed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider CLI is installed on this device.
          </p>
        ) : (
          <ul className="grid gap-3">
            {installed.map((runtime) => {
              const result = results[runtime.runtimeId]
              const busy = running === runtime.runtimeId
              return (
                <li key={runtime.runtimeId} className="rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{runtime.label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {(result?.version ?? runtime.version)
                          ? `Version ${result?.version ?? runtime.version}`
                          : "Version not reported"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || running !== undefined}
                      onClick={() => update(runtime.runtimeId)}
                    >
                      {busy ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                      {busy ? "Updating…" : "Update"}
                    </Button>
                  </div>

                  {result ? (
                    <p
                      className={cn(
                        "mt-2 flex items-start gap-1.5 text-xs",
                        result.outcome === "Failed" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {result.outcome === "Failed" ? (
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                      ) : (
                        <CircleCheck
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 shrink-0 text-success"
                        />
                      )}
                      <span>
                        <span className="font-medium">{result.outcome}.</span> {result.detail}
                      </span>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
