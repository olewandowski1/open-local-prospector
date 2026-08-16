import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Database,
  FolderOpen,
  type LucideIcon,
  Search,
} from "lucide-react"

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

export function SettingsPage({ readiness }: { readiness: readonly DependencyReadiness[] }) {
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
