"use client"

import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  CloudDownloadIcon,
  Copy01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useState } from "react"
import { Icon } from "@/components/icon"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type {
  RuntimeUpdateResult,
  RuntimeUpdateStatus,
} from "@/features/runtime-settings/application/runtime-update"
import { terminalCommand } from "@/features/runtime-settings/application/runtime-update"
import type { RuntimeId } from "@/features/runtime-settings/client"
import { RuntimeProviderIcon } from "@/features/runtime-settings/client"
import { cn } from "@/lib/utils"

type UpdateState = Readonly<Partial<Record<RuntimeId, RuntimeUpdateResult>>>

/** The check spawns both CLIs and reaches the network, so it is paid for once per browser session. */
const STATUS_CACHE_KEY = "v1:runtime-update-status"

/** How long the idle check will wait before going ahead on a page that never falls quiet. */
const IDLE_TIMEOUT_MILLISECONDS = 3_000

/**
 * Compares each installed provider CLI against its published release and runs the CLI's own update
 * command. An update is only ever flagged when both versions were read successfully; the install
 * itself is always performed by the provider CLI, never by this application.
 */
export function RuntimeUpdatePanel() {
  const [open, setOpen] = useState(false)
  const [statuses, setStatuses] = useState<readonly RuntimeUpdateStatus[]>()
  const [results, setResults] = useState<UpdateState>({})
  const [running, setRunning] = useState<RuntimeId>()

  useEffect(() => {
    const cached = readCachedStatuses()
    if (cached) {
      setStatuses(cached)
      return
    }
    let cancelled = false
    // This panel sits on every page, and the check spawns both provider CLIs. Knowing about an update
    // is never urgent, so it waits for an idle moment rather than competing with page load.
    const idle = whenIdle(() => {
      void (async () => {
        const loaded = await fetchStatuses()
        if (cancelled) return
        setStatuses(loaded)
        sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(loaded))
      })()
    })
    return () => {
      cancelled = true
      idle.cancel()
    }
  }, [])

  const updateAvailable = statuses?.some((status) => status.updateAvailable) === true
  const triggerLabel = updateAvailable ? "Update Available" : "Update Runtimes"

  const update = async (runtimeId: RuntimeId) => {
    setRunning(runtimeId)
    try {
      const response = await fetch(`/api/runtimes/${runtimeId}/update`, { method: "POST" })
      const result = (await response.json().catch(() => null)) as RuntimeUpdateResult | null
      const outcome = result ?? {
        outcome: "Failed" as const,
        detail: "The update could not be started.",
      }
      setResults((current) => ({ ...current, [runtimeId]: outcome }))
      if (outcome.outcome === "Failed") return
      // The installed version stays on show so the panel can keep displaying what changed; only the
      // flag that drives the sidebar affordance is cleared.
      setStatuses((current) =>
        current?.map((status) =>
          status.runtimeId === runtimeId ? { ...status, updateAvailable: false } : status,
        ),
      )
    } finally {
      setRunning(undefined)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant={updateAvailable ? "success" : "subtle"}
                  size="icon-sm"
                  aria-label={triggerLabel}
                >
                  <Icon icon={CloudDownloadIcon} />
                </Button>
              }
            />
          }
        />
        <TooltipContent>{triggerLabel}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Runtimes</DialogTitle>
          <DialogDescription>
            Installed versions are compared against each provider&rsquo;s published release. The CLI
            installs its own update.
          </DialogDescription>
        </DialogHeader>

        {statuses === undefined ? (
          <div
            role="status"
            aria-busy="true"
            aria-label="Checking Installed Runtimes"
            className="overflow-hidden rounded-lg border"
          >
            <RuntimeCardSkeleton />
            <Separator />
            <RuntimeCardSkeleton />
          </div>
        ) : statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider CLI is installed on this device.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border">
            {statuses.map((status, index) => (
              <li key={status.runtimeId}>
                <RuntimeUpdateCard
                  status={status}
                  result={results[status.runtimeId]}
                  busy={running === status.runtimeId}
                  disabled={running !== undefined}
                  onUpdate={() => update(status.runtimeId)}
                />
                {index < statuses.length - 1 ? <Separator /> : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RuntimeUpdateCard({
  status,
  result,
  busy,
  disabled,
  onUpdate,
}: {
  status: RuntimeUpdateStatus
  result?: RuntimeUpdateResult
  busy: boolean
  disabled: boolean
  onUpdate: () => void
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <RuntimeProviderIcon runtimeId={status.runtimeId} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{status.label}</p>
          <RuntimeVersionLine status={status} result={result} />
        </div>
        <Button size="sm" disabled={busy || disabled} onClick={onUpdate}>
          {busy ? (
            <Icon icon={Loading03Icon} data-icon="inline-start" className="animate-spin" />
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
            <Icon icon={AlertCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Icon icon={CheckmarkCircle02Icon} className="mt-0.5 size-3.5 shrink-0 text-success" />
          )}
          <span>
            <span className="font-medium">{result.outcome}.</span> {result.detail}
          </span>
        </p>
      ) : null}

      {result?.terminalInstruction ? (
        <TerminalCommand instruction={result.terminalInstruction} />
      ) : null}
    </div>
  )
}

/** The manual fallback, shown ready to copy rather than to read. */
function TerminalCommand({ instruction }: { instruction: string }) {
  const command = terminalCommand(instruction)

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-2">
      <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground select-all">
        {command}
      </code>
      <CopyButton value={command} />
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2_000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // A refused clipboard leaves the command on screen to be selected by hand.
    }
  }

  return (
    <IconButton
      label={copied ? "Copied" : "Copy Command"}
      variant="subtle"
      size="icon-xs"
      onClick={copy}
    >
      {copied ? <Icon icon={Tick02Icon} className="text-success" /> : <Icon icon={Copy01Icon} />}
    </IconButton>
  )
}

/** Shows `installed -> target` once a newer version is known, and the plain version otherwise. */
function RuntimeVersionLine({
  status,
  result,
}: {
  status: RuntimeUpdateStatus
  result?: RuntimeUpdateResult
}) {
  const target = result?.version ?? status.latest
  const changed =
    status.installed !== undefined && target !== undefined && target !== status.installed

  if (changed) {
    return (
      <p className="flex items-center gap-1 text-xs tabular-nums">
        <s className="text-muted-foreground">{status.installed}</s>
        <Icon icon={ArrowRight01Icon} className="size-3 text-muted-foreground" />
        <span className="font-medium text-foreground">{target}</span>
      </p>
    )
  }
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {status.installed ? `Version ${status.installed}` : "Version not reported"}
    </p>
  )
}

function RuntimeCardSkeleton() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  )
}

async function fetchStatuses(): Promise<readonly RuntimeUpdateStatus[]> {
  const response = await fetch("/api/runtimes/updates")
  const body = (await response.json().catch(() => null)) as {
    runtimes?: readonly RuntimeUpdateStatus[]
  } | null
  return body?.runtimes ?? []
}

function readCachedStatuses(): readonly RuntimeUpdateStatus[] | undefined {
  try {
    const cached = sessionStorage.getItem(STATUS_CACHE_KEY)
    return cached ? (JSON.parse(cached) as readonly RuntimeUpdateStatus[]) : undefined
  } catch {
    return undefined
  }
}

/** Runs a task once the browser is idle, with a timeout so it still happens on a busy page. */
function whenIdle(task: () => void): Readonly<{ cancel: () => void }> {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MILLISECONDS })
    return { cancel: () => cancelIdleCallback(handle) }
  }
  const handle = setTimeout(task, IDLE_TIMEOUT_MILLISECONDS)
  return { cancel: () => clearTimeout(handle) }
}
