"use client"

import { useEffect, useState } from "react"

import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
  type ThemePreference,
} from "@/features/local-application/application/theme-preference"

export type ResolvedTheme = "light" | "dark"

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function writeThemePreference(preference: ThemePreference): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the pre-paint script reads this synchronously
  document.cookie = `${THEME_COOKIE}=${preference};path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};samesite=lax`
  document.documentElement.classList.toggle("dark", resolveTheme(preference) === "dark")
}

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
