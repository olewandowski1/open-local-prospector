"use client"

import { MoonStar, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
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
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => select(next)}
    >
      {resolved === "dark" ? <Sun aria-hidden="true" /> : <MoonStar aria-hidden="true" />}
    </Button>
  )
}
