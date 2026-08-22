import { Skeleton } from "@/components/ui/skeleton"

export function RuntimeSteeringSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">Run Steering</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            The runtime, model, and reasoning effort that new prospecting runs start from. Provider
            logins stay in their own terminals.
          </p>
        </div>
        <Skeleton className="h-5 w-24 rounded-4xl" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid gap-5 sm:grid-cols-3">
          {["runtime", "model", "effort"].map((field) => (
            <div key={field} className="grid gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
