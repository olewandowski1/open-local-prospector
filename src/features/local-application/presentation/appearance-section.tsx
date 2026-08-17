"use client"

import type { LucideIcon } from "lucide-react"
import { Check, Monitor, MoonStar, Sun } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ThemePreference } from "@/features/local-application/application/theme-preference"
import { useTheme } from "@/features/local-application/presentation/use-theme"
import { cn } from "@/lib/utils"

const options: readonly Readonly<{
  value: ThemePreference
  label: string
  detail: string
  icon: LucideIcon
}>[] = [
  {
    value: "system",
    label: "System",
    detail: "Follows the operating system setting.",
    icon: Monitor,
  },
  { value: "light", label: "Light", detail: "Always the light surface.", icon: Sun },
  { value: "dark", label: "Dark", detail: "Always the dark surface.", icon: MoonStar },
]

export function AppearanceSection({ theme }: { theme: ThemePreference }) {
  // Shares one writer with the header toggle, so the two controls can never disagree.
  const { preference: selected, select } = useTheme(theme)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Stored on this device. The palette stays monotone in both surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">Theme</legend>
          {options.map((option) => {
            const active = selected === option.value
            return (
              <label
                key={option.value}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors",
                  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  active ? "border-foreground/40 bg-muted/60" : "hover:bg-muted/40",
                )}
              >
                {/* Covers the label so the native control stays the click and focus target. */}
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={active}
                  onChange={() => select(option.value)}
                  className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                />
                <span className="flex items-center gap-2">
                  <option.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{option.label}</span>
                  {active ? (
                    <Check aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{option.detail}</span>
              </label>
            )
          })}
        </fieldset>
      </CardContent>
    </Card>
  )
}
