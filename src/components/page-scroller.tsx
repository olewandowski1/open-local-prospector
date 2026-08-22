"use client"

import type { ComponentProps } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// The single vertical scroll owner for a route, so the page moves as one document.
export function PageScroller({ className, ...props }: ComponentProps<"div">) {
  return (
    <ScrollArea data-page-scroller className="min-h-0 flex-1">
      <div className={cn("min-h-full p-4 sm:p-6", className)} {...props} />
    </ScrollArea>
  )
}
