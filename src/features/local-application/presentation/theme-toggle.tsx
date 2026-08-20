"use client"

import { MoonStar, Sun } from "lucide-react"

import { IconButton } from "@/components/icon-button"
import { useThemePreference } from "@/features/local-application/presentation/theme-provider"
import { useTheme } from "@/features/local-application/presentation/use-theme"

/**
 * Flips between the light and dark surfaces. Choosing here sets an explicit preference, so it stops
 * following the operating system; `System` remains available in Appearance settings.
 */
export function ThemeToggle() {
  const { resolved, select } = useTheme(useThemePreference())
  const next = resolved === "dark" ? "light" : "dark"

  return (
    <IconButton
      label={next === "dark" ? "Switch To Dark Theme" : "Switch To Light Theme"}
      variant="subtle"
      size="icon-sm"
      onClick={() => select(next)}
    >
      {resolved === "dark" ? <Sun aria-hidden="true" /> : <MoonStar aria-hidden="true" />}
    </IconButton>
  )
}
