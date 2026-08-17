import type { LucideIcon } from "lucide-react"
import { Archive, Circle, CircleCheck, CircleX, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { reviewStatusVariant } from "@/features/review-queue/presentation/review-presentation"
import { cn } from "@/lib/utils"

const statusIcons: Readonly<Record<string, LucideIcon>> = {
  Unreviewed: Circle,
  Shortlisted: CircleCheck,
  Rejected: CircleX,
  Contacted: Send,
  Archived: Archive,
}

/** One badge for a review decision, so every surface reads the same status the same way. */
export function CandidateStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const Icon = statusIcons[status] ?? Circle
  return (
    <Badge variant={reviewStatusVariant(status)} className={cn("shrink-0", className)}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {status}
    </Badge>
  )
}
