import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function BrandMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeLinecap="round">
        <circle
          cx="32"
          cy="32"
          r="26"
          strokeWidth="3"
          strokeDasharray="133 31"
          transform="rotate(-45 32 32)"
        />
        <circle
          cx="32"
          cy="32"
          r="18"
          strokeWidth="3.25"
          strokeDasharray="89 25"
          transform="rotate(-45 32 32)"
        />
        <circle
          cx="32"
          cy="32"
          r="10"
          strokeWidth="3.5"
          strokeDasharray="45 18"
          transform="rotate(-45 32 32)"
        />
      </g>
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
    </svg>
  )
}
