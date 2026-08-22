"use client"

import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/icon"

import { Button } from "@/components/ui/button"
import type { ThemePreference } from "@/features/local-application/application/theme-preference"
import { useTheme } from "@/features/local-application/presentation/use-theme"

export function AppearanceSection({ theme }: { theme: ThemePreference }) {
  // A stored `system` preference resolves to a surface; the control offers only the two concrete outcomes.
  const { resolved, select } = useTheme(theme)
  const resolvedIcon = resolved === "dark" ? Moon02Icon : Sun01Icon

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Icon icon={resolvedIcon} className="size-5 shrink-0 text-muted-foreground" />
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
          <Icon icon={Sun01Icon} />
          Light
        </Button>
        <Button
          type="button"
          size="sm"
          variant={resolved === "dark" ? "secondary" : "ghost"}
          aria-pressed={resolved === "dark"}
          onClick={() => select("dark")}
        >
          <Icon icon={Moon02Icon} />
          Dark
        </Button>
      </fieldset>
    </div>
  )
}
