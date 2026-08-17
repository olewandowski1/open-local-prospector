import type { LucideIcon } from "lucide-react"
import { CheckCircle2, CircleAlert, CircleHelp, Database, FolderOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  DependencyReadiness,
  ReadinessStatus,
} from "@/features/local-application/readiness/get-local-readiness"

const dependencyIcons: Record<DependencyReadiness["id"], LucideIcon> = {
  sqlite: Database,
  playwright: CircleHelp,
  disk: FolderOpen,
}

const statusPresentation: Record<
  ReadinessStatus,
  Readonly<{ variant: "secondary" | "outline" | "destructive"; icon: LucideIcon }>
> = {
  Ready: { variant: "secondary", icon: CheckCircle2 },
  Missing: { variant: "outline", icon: CircleAlert },
  Unreachable: { variant: "destructive", icon: CircleAlert },
  "Unsupported Version": { variant: "destructive", icon: CircleAlert },
}

export function LocalReadinessSection({
  readiness,
}: {
  readiness: readonly DependencyReadiness[]
}) {
  return (
    <section aria-label="Local dependency readiness" className="grid gap-3 sm:grid-cols-2">
      {readiness.map((item) => {
        const Icon = dependencyIcons[item.id]
        const { icon: StatusIcon, variant } = statusPresentation[item.status]

        return (
          <Card key={item.id} size="sm">
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
  )
}
