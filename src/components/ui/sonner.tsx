"use client"

import { Toaster as SonnerToaster } from "sonner"

import { useThemePreference } from "@/features/local-application/presentation/theme-provider"
import { useTheme } from "@/features/local-application/presentation/use-theme"

/**
 * Transient confirmation for actions that would otherwise leave no trace, such as recording a review
 * decision. Driven by this application's own cookie-backed theme rather than `next-themes`, so there
 * is one source of truth for which surface is showing.
 */
export function Toaster() {
  const { resolved } = useTheme(useThemePreference())

  return (
    <SonnerToaster
      theme={resolved}
      position="bottom-right"
      // The palette is monotone, so toasts borrow the same tokens as every other raised surface.
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-lg",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
        },
      }}
    />
  )
}
