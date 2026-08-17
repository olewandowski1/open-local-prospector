import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Stands in for the steering panel while runtime readiness is probed. It mirrors the panel's real
 * shape — header badge, three fields, footer actions — so the card does not resize when the
 * streamed content arrives.
 */
export function RuntimeSteeringSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle>Run Steering</CardTitle>
        <CardDescription>
          The runtime, model, and reasoning effort that new prospecting runs start from. Provider
          logins stay in their own terminals.
        </CardDescription>
        <CardAction>
          <Skeleton className="h-5 w-24 rounded-4xl" />
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-5 sm:grid-cols-3">
        {["runtime", "model", "effort"].map((field) => (
          <div key={field} className="grid gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-3 border-t">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </CardFooter>
    </Card>
  )
}
