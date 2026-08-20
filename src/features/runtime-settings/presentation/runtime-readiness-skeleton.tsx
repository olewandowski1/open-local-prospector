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
      className="grid gap-3"
    >
      {["codex", "claude"].map((runtime) => (
        <div key={runtime} className="flex items-center gap-4 rounded-xl border p-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  )
}
