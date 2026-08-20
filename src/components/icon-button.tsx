"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type TooltipSide = ComponentProps<typeof TooltipContent>["side"]

type IconButtonProps = ComponentProps<typeof Button> &
  Readonly<{
    /** Names the action for both the accessible name and the tooltip, so the two cannot drift. */
    label: string
    side?: TooltipSide
  }>

/**
 * An icon-only button that says what it does on hover and to a screen reader. Icons alone carry no
 * reliable meaning, so every icon control in the workspace goes through here rather than relying on a
 * native `title`, which is slow to appear and invisible to keyboard users.
 */
export function IconButton({ label, side = "top", children, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button aria-label={label} {...props}>
            {children}
          </Button>
        }
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

type IconLinkProps = Omit<ComponentProps<typeof Link>, "children"> &
  Readonly<{
    label: string
    side?: TooltipSide
    variant?: ComponentProps<typeof Button>["variant"]
    size?: ComponentProps<typeof Button>["size"]
    children: React.ReactNode
  }>

/**
 * The navigating counterpart of {@link IconButton}. It renders a real anchor rather than a button
 * behaving like one: assistive technology announces it as a link, and it keeps the behaviours readers
 * expect of one, such as opening in a new tab.
 */
export function IconLink({
  label,
  side = "top",
  variant = "ghost",
  size = "icon-xs",
  className,
  children,
  ...props
}: IconLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            aria-label={label}
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
          >
            {children}
          </Link>
        }
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
