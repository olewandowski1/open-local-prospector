import { describe, expect, it } from "vitest"
import {
  isThemePreference,
  parseThemePreference,
  THEME_COOKIE,
  themeClassName,
  themeResolverScript,
} from "@/features/local-application/application/theme-preference"

describe("theme preference", () => {
  it("falls back to following the system when nothing is stored", () => {
    expect(parseThemePreference(undefined)).toBe("system")
    expect(parseThemePreference("")).toBe("system")
    expect(parseThemePreference("neon")).toBe("system")
  })

  it("accepts only the supported preferences", () => {
    expect(isThemePreference("dark")).toBe(true)
    expect(isThemePreference("light")).toBe(true)
    expect(isThemePreference("system")).toBe(true)
    expect(isThemePreference("Dark")).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })

  it("only forces the dark class for an explicit dark preference", () => {
    expect(themeClassName("dark")).toBe("dark")
    expect(themeClassName("light")).toBeUndefined()
    // `system` is resolved in the browser, so the server must not guess.
    expect(themeClassName("system")).toBeUndefined()
  })

  it("resolves the same cookie the server reads", () => {
    expect(themeResolverScript).toContain(THEME_COOKIE)
    expect(themeResolverScript).toContain("prefers-color-scheme: dark")
  })
})
