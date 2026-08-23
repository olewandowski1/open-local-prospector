"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"

export function InfoButton({ description }: { description: string }) {
  return (
    <IconButton
      type="button"
      label={description}
      variant="ghost"
      size="icon-xs"
      side="top"
      className="size-5"
    >
      <Icon icon={InformationCircleIcon} className="size-3.5" />
    </IconButton>
  )
}
