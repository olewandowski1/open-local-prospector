"use client"

import { MoonStar, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ThemePreference } from "@/features/local-application/application/theme-preference"
import { useTheme } from "@/features/local-application/presentation/use-theme"

export function AppearanceSection({ theme }: { theme: ThemePreference }) {
  // A stored `system` preference resolves to the current surface; the control intentionally exposes
  // only the two concrete outcomes and persists one only after the operator chooses it.
  const { resolved, select } = useTheme(theme)
  const Icon = resolved === "dark" ? MoonStar : Sun

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-52 flex-1">
        <h3 className="font-heading font-medium">Theme</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Defaults to this device&apos;s light or dark appearance until you choose one.
        </p>
      </div>
      <fieldset aria-label="Theme" className="flex rounded-lg border p-1">
        <Button
          type="button"
          size="sm"
          variant={resolved === "light" ? "secondary" : "ghost"}
          aria-pressed={resolved === "light"}
          onClick={() => select("light")}
        >
          <Sun aria-hidden="true" />
          Light
        </Button>
        <Button
          type="button"
          size="sm"
          variant={resolved === "dark" ? "secondary" : "ghost"}
          aria-pressed={resolved === "dark"}
          onClick={() => select("dark")}
        >
          <MoonStar aria-hidden="true" />
          Dark
        </Button>
      </fieldset>
    </div>
  )
}
