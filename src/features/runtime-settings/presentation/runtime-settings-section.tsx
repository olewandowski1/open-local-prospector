import { Terminal } from "lucide-react"

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

const statusVariant: Record<RuntimeReadinessStatus, "secondary" | "outline" | "destructive"> = {
  Ready: "secondary",
  Missing: "outline",
  "Logged Out": "outline",
  Unreachable: "destructive",
  "Unsupported Version": "destructive",
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
    <section aria-labelledby="runtime-readiness-title" className="mt-8">
      <div>
        <h2 id="runtime-readiness-title" className="font-heading text-lg font-semibold">
          Subscription runtimes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Login remains in each provider&apos;s terminal. The application stores only your selected
          runtime.
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {runtimes.map((runtime) => {
          const selected = runtime.runtimeId === selectedRuntime
          return (
            <Card key={runtime.runtimeId} size="sm">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Terminal aria-hidden="true" />
                </div>
                <CardTitle>{runtime.label}</CardTitle>
                <CardDescription>
                  {runtime.detail}
                  {runtime.version ? ` Version ${runtime.version}.` : ""}
                </CardDescription>
                <CardAction>
                  <Badge variant={statusVariant[runtime.status]}>{runtime.status}</Badge>
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
                    variant={selected ? "secondary" : "outline"}
                    disabled={runtime.status !== "Ready" || selected}
                    className="w-full"
                  >
                    {selected ? "Selected" : "Use runtime"}
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
