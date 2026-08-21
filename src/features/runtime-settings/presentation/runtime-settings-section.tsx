import type { LucideIcon } from "lucide-react"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type {
  RuntimeId,
  RuntimeReadiness,
  RuntimeReadinessStatus,
} from "@/features/runtime-settings"
import { RuntimeProviderIcon } from "@/features/runtime-settings/presentation/runtime-provider-icon"
import { cn } from "@/lib/utils"

/**
 * Readiness is the one place this interface uses colour: a runtime is either usable or it is not.
 */
const statusPresentation: Record<
  RuntimeReadinessStatus,
  Readonly<{ className: string; icon: LucideIcon }>
> = {
  Ready: { className: "text-success", icon: Check },
  Missing: { className: "text-warning", icon: X },
  "Logged Out": { className: "text-warning", icon: X },
  Unreachable: { className: "text-destructive", icon: X },
  "Unsupported Version": { className: "text-warning", icon: X },
}

export function RuntimeSettingsSection({
  runtimes,
  selectedRuntime,
  selectRuntime,
}: {
  runtimes: readonly RuntimeReadiness[]
  selectedRuntime?: RuntimeId
  selectRuntime: (formData: FormData) => Promise<void>
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      {runtimes.map((runtime, index) => {
        const selected = runtime.runtimeId === selectedRuntime
        const status = statusPresentation[runtime.status]
        const StatusIcon = status.icon
        return (
          <div key={runtime.runtimeId}>
            <div className="flex items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border text-foreground">
                  <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading font-medium">{runtime.label}</h3>
                    <span
                      className={cn("inline-flex items-center gap-1 text-sm", status.className)}
                    >
                      <StatusIcon className="size-3.5" aria-hidden="true" />
                      {runtime.status}
                    </span>
                  </div>
                  {runtime.version ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Version {runtime.version}
                    </p>
                  ) : null}
                  {runtime.terminalInstruction ? (
                    <code className="mt-1 block text-xs break-all text-muted-foreground">
                      {runtime.terminalInstruction}
                    </code>
                  ) : null}
                </div>
              </div>
              <form action={selectRuntime} className="shrink-0">
                <input type="hidden" name="runtimeId" value={runtime.runtimeId} />
                <Button
                  type="submit"
                  variant={selected ? "success" : "info"}
                  disabled={runtime.status !== "Ready" || selected}
                  className={cn(selected && "disabled:opacity-100")}
                >
                  {selected ? (
                    <>
                      <Check data-icon="inline-start" aria-hidden="true" />
                      Active Runtime
                    </>
                  ) : (
                    `Use ${runtime.label}`
                  )}
                </Button>
              </form>
            </div>
            {index < runtimes.length - 1 ? <Separator /> : null}
          </div>
        )
      })}
    </div>
  )
}
