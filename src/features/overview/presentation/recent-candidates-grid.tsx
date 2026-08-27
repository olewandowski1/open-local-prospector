import { LinkSquare02Icon, Route01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { Icon } from "@/components/icon"
import { IconLink } from "@/components/icon-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CandidateStatusBadge, formatScore, type RecentCandidate } from "@/features/review-queue"

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

function humanizeClassName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

function reviewHref(candidateId: string): string {
  return `/review?candidate=${encodeURIComponent(candidateId)}`
}

export function RecentCandidatesGrid({ candidates }: { candidates: readonly RecentCandidate[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[168px] @xl:w-[240px] @2xl:w-[200px]">Business</TableHead>
          <TableHead className="hidden w-[160px] @2xl:table-cell">Opportunity</TableHead>
          <TableHead>Score</TableHead>
          <TableHead className="hidden @4xl:table-cell">Contact Route</TableHead>
          <TableHead className="hidden @md:table-cell">Review Status</TableHead>
          <TableHead className="hidden @4xl:table-cell">Scored</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => (
          <TableRow key={candidate.id}>
            <TableCell className="w-[168px] @xl:w-[240px] @2xl:w-[200px]">
              <Link
                href={reviewHref(candidate.id)}
                className="block min-w-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className="block w-[152px] truncate font-medium @xl:w-[224px] @2xl:w-[184px]"
                  title={candidate.name}
                >
                  {candidate.name}
                </span>
                <span className="block w-[152px] truncate text-xs text-muted-foreground @xl:w-[224px] @2xl:w-[184px]">
                  {candidate.locality}
                </span>
              </Link>
            </TableCell>
            <TableCell className="hidden w-[160px] @2xl:table-cell">
              <span
                className="block truncate text-muted-foreground"
                title={humanizeClassName(candidate.primaryOpportunity)}
              >
                {humanizeClassName(candidate.primaryOpportunity)}
              </span>
            </TableCell>
            <TableCell>
              <span className="tabular-nums font-medium">{formatScore(candidate.score)}</span>
            </TableCell>
            <TableCell className="hidden text-muted-foreground @4xl:table-cell">
              {candidate.contactAvailable ? "Available" : "None"}
            </TableCell>
            <TableCell className="hidden @md:table-cell">
              <CandidateStatusBadge status={candidate.reviewStatus} />
            </TableCell>
            <TableCell className="hidden @4xl:table-cell">
              <time dateTime={candidate.scoredAt} className="text-xs text-muted-foreground">
                {dateFormat.format(new Date(candidate.scoredAt))}
              </time>
            </TableCell>
            <TableCell className="text-right">
              <RowActions candidate={candidate} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RowActions({ candidate }: { candidate: RecentCandidate }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink label="Open In Review" href={reviewHref(candidate.id)}>
        <Icon icon={LinkSquare02Icon} />
      </IconLink>
      <IconLink label="Open Source Run" href={`/runs/${candidate.runId}`}>
        <Icon icon={Route01Icon} />
      </IconLink>
    </div>
  )
}
