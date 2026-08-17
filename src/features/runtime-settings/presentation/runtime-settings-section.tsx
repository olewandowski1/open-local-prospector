import type { LucideIcon } from "lucide-react"
import { Check, CircleAlert, CircleCheck, CircleSlash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  RuntimeId,
  RuntimeReadiness,
  RuntimeReadinessStatus,
} from "@/features/runtime-settings"
import { RuntimeProviderIcon } from "@/features/runtime-settings/presentation/runtime-provider-icon"

/**
 * Readiness is the one place this interface uses colour: a runtime is either usable or it is not,
 * and that distinction is worth more than palette consistency.
 */
const statusPresentation: Record<
  RuntimeReadinessStatus,
  Readonly<{ variant: "success" | "destructive"; icon: LucideIcon }>
> = {
  Ready: { variant: "success", icon: CircleCheck },
  Missing: { variant: "destructive", icon: CircleSlash },
  "Logged Out": { variant: "destructive", icon: CircleSlash },
  Unreachable: { variant: "destructive", icon: CircleAlert },
  "Unsupported Version": { variant: "destructive", icon: CircleAlert },
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
    <section aria-label="Subscription Runtimes">
      <div className="grid gap-3 sm:grid-cols-2">
        {runtimes.map((runtime) => {
          const selected = runtime.runtimeId === selectedRuntime
          const status = statusPresentation[runtime.status]
          const StatusIcon = status.icon
          return (
            <Card key={runtime.runtimeId} size="sm">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
                  <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                </div>
                <CardTitle>{runtime.label}</CardTitle>
                <CardDescription>
                  {runtime.detail}
                  {runtime.version ? ` Version ${runtime.version}.` : ""}
                </CardDescription>
                <CardAction>
                  <Badge variant={status.variant}>
                    <StatusIcon data-icon="inline-start" aria-hidden="true" />
                    {runtime.status}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="mt-auto grid gap-3">
                {runtime.terminalInstruction ? (
                  <code className="rounded-md bg-muted px-3 py-2 text-xs">
                    {runtime.terminalInstruction}
                  </code>
                ) : null}
                <form action={selectRuntime}>
                  <input type="hidden" name="runtimeId" value={runtime.runtimeId} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={selected ? "outline" : "default"}
                    disabled={runtime.status !== "Ready" || selected}
                    className={selected ? "w-full text-success disabled:opacity-100" : "w-full"}
                  >
                    {selected ? (
                      <>
                        <Check data-icon="inline-start" aria-hidden="true" />
                        Selected
                      </>
                    ) : (
                      "Use Runtime"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
