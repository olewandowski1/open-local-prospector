import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Database,
  FolderOpen,
  type LucideIcon,
  Search,
  Terminal,
} from "lucide-react"

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
  DependencyReadiness,
  ReadinessStatus,
} from "@/features/local-application/readiness/get-local-readiness"
import type {
  RuntimeId,
  RuntimeReadiness,
  RuntimeReadinessStatus,
} from "@/features/runtime-settings"

const dependencyIcons = {
  sqlite: Database,
  "brave-search": Search,
  playwright: CircleHelp,
  disk: FolderOpen,
} as const

const statusPresentation: Record<
  ReadinessStatus,
  Readonly<{ variant: "secondary" | "outline" | "destructive"; icon: LucideIcon }>
> = {
  Ready: { variant: "secondary", icon: CheckCircle2 },
  Missing: { variant: "outline", icon: CircleAlert },
  Unreachable: { variant: "destructive", icon: CircleAlert },
  "Unsupported Version": { variant: "destructive", icon: CircleAlert },
}

const runtimeStatusVariant: Record<
  RuntimeReadinessStatus,
  "secondary" | "outline" | "destructive"
> = {
  Ready: "secondary",
  Missing: "outline",
  "Logged Out": "outline",
  Unreachable: "destructive",
  "Unsupported Version": "destructive",
}

export function SettingsPage({
  readiness,
  runtimes,
  selectedRuntime,
  selectRuntime,
}: {
  readiness: readonly DependencyReadiness[]
  runtimes: readonly RuntimeReadiness[]
  selectedRuntime?: RuntimeId
  selectRuntime: (formData: FormData) => Promise<void>
}) {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Local readiness</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Check the on-device dependencies used for discovery and website inspection. Provider
          subscription logins stay outside this application.
        </p>
      </div>

      <section aria-label="Local dependency readiness" className="mt-6 grid gap-4 md:grid-cols-2">
        {readiness.map((item) => {
          const Icon = dependencyIcons[item.id]
          const { icon: StatusIcon, variant } = statusPresentation[item.status]

          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden="true" />
                </div>
                <CardTitle>{item.label}</CardTitle>
                <CardDescription>{item.detail}</CardDescription>
                <CardAction>
                  <Badge variant={variant}>
                    <StatusIcon data-icon="inline-start" aria-hidden="true" />
                    {item.status}
                  </Badge>
                </CardAction>
              </CardHeader>
            </Card>
          )
        })}
      </section>

      <section aria-labelledby="runtime-readiness-title" className="mt-8">
        <div>
          <h2 id="runtime-readiness-title" className="font-heading text-lg font-semibold">
            Subscription runtimes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Login remains in each provider&apos;s terminal. The application stores only your
            selected runtime.
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
                    <Badge variant={runtimeStatusVariant[runtime.status]}>{runtime.status}</Badge>
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

      <Card className="mt-4 bg-muted/30">
        <CardContent>
          <p className="text-sm font-medium">Secrets stay local</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Settings only reports whether Brave Search is configured. The API key is never shown,
            sent to the browser, or written to application logs.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
