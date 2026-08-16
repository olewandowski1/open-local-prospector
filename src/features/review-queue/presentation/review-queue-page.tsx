import { CircleGauge, Plus } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getReviewQueue } from "@/features/review-queue/server/review-queue-read-model"

export function ReviewQueuePage() {
  const candidates = getReviewQueue()
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eligible businesses ranked by deterministic, evidence-backed opportunity score.
          </p>
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New run
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Qualified candidates</CardTitle>
          <CardDescription>
            Threshold 60 · stable ordering by score and business name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleGauge />
                </EmptyMedia>
                <EmptyTitle>No qualified candidates yet</EmptyTitle>
                <EmptyDescription>
                  Complete a prospecting run to populate this queue with persisted results.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {candidate.locality} ·{" "}
                        {candidate.websiteAvailable ? "Website" : "No website"} ·{" "}
                        {candidate.contactAvailable ? "Contact available" : "No contact"}
                      </p>
                    </TableCell>
                    <TableCell>{candidate.primaryOpportunity}</TableCell>
                    <TableCell>
                      <p className="max-w-80 truncate text-sm">{candidate.observations[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(candidate.confidence * 100)}% confidence ·{" "}
                        {candidate.inspectionState}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{candidate.reviewStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <details>
                        <summary className="cursor-pointer font-semibold tabular-nums">
                          {candidate.score}
                        </summary>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Severity {candidate.breakdown.severity} + confidence{" "}
                          {candidate.breakdown.confidence} + contact {candidate.breakdown.contact} +
                          local {candidate.breakdown.localDecision} + value{" "}
                          {candidate.breakdown.commercialValue}
                          <br />
                          {candidate.rubricVersion}
                        </p>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
