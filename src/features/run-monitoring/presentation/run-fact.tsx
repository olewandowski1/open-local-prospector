import { cn } from "@/lib/utils"

/**
 * The run detail states a fact as a labelled row, so Run Overview and Run Progress read the same
 * way: name on the left, value on the right, one rule between each.
 */
export function RunFactList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <dl className={cn("overflow-hidden rounded-xl border", className)}>{children}</dl>
}

export function RunFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t p-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm sm:text-right">{children}</dd>
    </div>
  )
}
