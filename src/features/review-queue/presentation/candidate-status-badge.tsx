import {
  ArchiveIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { Icon, type IconSvg } from "@/components/icon"

import { Badge } from "@/components/ui/badge"
import { reviewStatusVariant } from "@/features/review-queue/presentation/review-presentation"
import { cn } from "@/lib/utils"

const statusIcons: Readonly<Record<string, IconSvg>> = {
  Unreviewed: CircleIcon,
  Shortlisted: CheckmarkCircle02Icon,
  Rejected: CancelCircleIcon,
  Contacted: SentIcon,
  Archived: ArchiveIcon,
}

export function CandidateStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const icon = statusIcons[status] ?? CircleIcon
  return (
    <Badge variant={reviewStatusVariant(status)} className={cn("shrink-0", className)}>
      <Icon icon={icon} data-icon="inline-start" />
      {status}
    </Badge>
  )
}
