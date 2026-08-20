import type { LucideIcon } from "lucide-react"
import { Database, Palette, Settings2, Sparkles, Wrench } from "lucide-react"

export type SettingsSection = Readonly<{
  label: string
  href: string
  description: string
  icon: LucideIcon
}>

export const settingsSections: readonly SettingsSection[] = [
  {
    label: "General",
    href: "/settings/general",
    description: "Local storage and on-device dependencies.",
    icon: Settings2,
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    description: "How the workspace looks on this device.",
    icon: Palette,
  },
  {
    label: "Subscription",
    href: "/settings/subscription",
    description: "Provider runtimes this workspace can use.",
    icon: Sparkles,
  },
  {
    label: "Data",
    href: "/settings/data",
    description: "Storage usage and suppressed businesses.",
    icon: Database,
  },
  {
    label: "Maintenance",
    href: "/settings/maintenance",
    description: "Back up, restore, compact or reset this workspace.",
    icon: Wrench,
  },
]

export function settingsSectionFor(pathname: string): SettingsSection | undefined {
  return settingsSections.find((section) => section.href === pathname)
}
