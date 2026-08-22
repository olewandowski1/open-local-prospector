import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  // Measured on the header, not the viewport: the sidebar makes this column narrower at 768px than at 640px.
  return (
    <div className={cn("@container", className)}>
      <header className="flex flex-col gap-4 @md:flex-row @md:items-start @md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 text-xs font-medium text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("@container", className)}>
      <header className="flex flex-col gap-3 @md:flex-row @md:items-start @md:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
    </div>
  )
}
