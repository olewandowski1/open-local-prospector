import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder shown while provider CLIs are probed. Probing spawns subprocesses, so the section list
 * and the rest of the page render without waiting for it.
 */
export function RuntimeReadinessSkeleton() {
  return (
    // Deliberately not named "Subscription Runtimes": the placeholder must not stand in for the
    // real region for assistive technology or for tests waiting on it.
    <div
      role="status"
      aria-busy="true"
      aria-label="Checking Subscription Runtimes"
      className="grid gap-3 sm:grid-cols-2"
    >
      {["codex", "claude"].map((runtime) => (
        <Card key={runtime} size="sm">
          <CardHeader className="gap-2">
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
