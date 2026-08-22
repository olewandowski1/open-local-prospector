import {
  DatabaseIcon,
  PaintBoardIcon,
  Settings02Icon,
  SparklesIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvg } from "@/components/icon"

export type SettingsSection = Readonly<{
  label: string
  href: string
  description: string
  icon: IconSvg
}>

export const settingsSections: readonly SettingsSection[] = [
  {
    label: "General",
    href: "/settings/general",
    description: "Local storage and on-device dependencies.",
    icon: Settings02Icon,
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    description: "How the workspace looks on this device.",
    icon: PaintBoardIcon,
  },
  {
    label: "Subscription",
    href: "/settings/subscription",
    description: "Provider runtimes this workspace can use.",
    icon: SparklesIcon,
  },
  {
    label: "Data",
    href: "/settings/data",
    description: "Storage usage and suppressed businesses.",
    icon: DatabaseIcon,
  },
  {
    label: "Maintenance",
    href: "/settings/maintenance",
    description: "Back up, restore, compact or reset this workspace.",
    icon: Wrench01Icon,
  },
]

export function settingsSectionFor(pathname: string): SettingsSection | undefined {
  return settingsSections.find((section) => section.href === pathname)
}
