"use client"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BusinessProgress } from "@/features/run-monitoring/domain/run-progress"
import { humanizeStage } from "@/features/run-monitoring/presentation/run-presentation"
import { cn } from "@/lib/utils"

const failedStatuses = ["FailedPermanent", "Failed", "Excluded"]

export function RunBusinessesTable({
  businesses,
  selectedBusinessId,
  onSelect,
}: {
  businesses: readonly BusinessProgress[]
  selectedBusinessId?: string
  onSelect: (businessId?: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Per-Business Progress
        </CardTitle>
        <CardDescription>
          Select a business to narrow the Technical Run Log to its events.
        </CardDescription>
        {selectedBusinessId ? (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
              Clear Selection
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {businesses.length === 0 ? (
          <p className="px-(--card-spacing) text-sm text-muted-foreground">
            No per-business work has been checkpointed yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((business) => {
                const selected = business.id === selectedBusinessId
                return (
                  <TableRow
                    key={business.id}
                    onClick={() => onSelect(selected ? undefined : business.id)}
                    aria-selected={selected}
                    className={cn("cursor-pointer", selected && "bg-muted/60")}
                  >
                    <TableCell>
                      <span className="block max-w-80 truncate font-medium">
                        {business.name ?? business.id}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {business.sourceEvents.length}{" "}
                        {business.sourceEvents.length === 1 ? "Event" : "Events"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {humanizeStage(business.currentStage)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={failedStatuses.includes(business.status) ? "outline" : "secondary"}
                      >
                        {humanizeStage(business.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{business.retryCount}</TableCell>
                    <TableCell className="max-w-72 text-xs whitespace-normal text-muted-foreground">
                      {business.failureReason ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
