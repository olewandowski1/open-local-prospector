"use client"

import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/icon"

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
      {resolved === "dark" ? <Icon icon={Sun01Icon} /> : <Icon icon={Moon02Icon} />}
    </IconButton>
  )
}
