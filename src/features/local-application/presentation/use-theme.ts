"use client"

import { useEffect, useState } from "react"

import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
  type ThemePreference,
} from "@/features/local-application/application/theme-preference"

/** The surface actually being displayed once `system` has been resolved against the device. */
export type ResolvedTheme = "light" | "dark"

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Single writer for the appearance preference. The cookie is intentionally readable by the client so
 * the pre-paint script and the server render agree, so it is written here rather than through a
 * server action.
 */
export function writeThemePreference(preference: ThemePreference): void {
  document.cookie = `${THEME_COOKIE}=${preference};path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};samesite=lax`
  document.documentElement.classList.toggle("dark", resolveTheme(preference) === "dark")
}

/**
 * Tracks the stored preference and the surface it resolves to. Starts from the value the server
 * rendered so the first paint never disagrees with the markup.
 */
export function useTheme(initial: ThemePreference) {
  const [preference, setPreference] = useState<ThemePreference>(initial)
  const [resolved, setResolved] = useState<ResolvedTheme>(initial === "dark" ? "dark" : "light")

  useEffect(() => {
    setResolved(resolveTheme(preference))
  }, [preference])

  const select = (next: ThemePreference) => {
    writeThemePreference(next)
    setPreference(next)
    setResolved(resolveTheme(next))
  }

  return { preference, resolved, select }
}
