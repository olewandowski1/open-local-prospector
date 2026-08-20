"use client"

import { createContext, type ReactNode, use } from "react"

import type { ThemePreference } from "@/features/local-application/application/theme-preference"

const ThemePreferenceContext = createContext<ThemePreference>("system")

/**
 * Carries the server-read preference to client controls, so every toggle starts from the same value
 * the document was rendered with instead of re-reading the cookie and risking a flash.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemePreference
  children: ReactNode
}) {
  return <ThemePreferenceContext value={theme}>{children}</ThemePreferenceContext>
}

export function useThemePreference(): ThemePreference {
  return use(ThemePreferenceContext)
}
