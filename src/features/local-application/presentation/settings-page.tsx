import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Database,
  FolderOpen,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
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

const dependencyIcons = {
  sqlite: Database,
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

export function SettingsPage({
  readiness,
  children,
}: {
  readiness: readonly DependencyReadiness[]
  children?: ReactNode
}) {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Local readiness</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Check the on-device dependencies used for local storage and website inspection. Discovery
          uses the selected provider subscription login, which stays outside this application.
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

      {children}

      <Card className="mt-4 bg-muted/30">
        <CardContent>
          <p className="text-sm font-medium">No search API key required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Codex, Claude Code, or OpenCode performs discovery through its constrained web-search
            capability. The application never requests or stores provider credentials.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
