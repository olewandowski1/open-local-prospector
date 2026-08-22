"use client"

import { createContext, type ReactNode, use } from "react"

import type { ThemePreference } from "@/features/local-application/application/theme-preference"

const ThemePreferenceContext = createContext<ThemePreference>("system")

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
