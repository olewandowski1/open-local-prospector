import type { LucideIcon } from "lucide-react"
import { Building2, FileSearch, History, LayoutDashboard, ListChecks, Settings } from "lucide-react"

export type NavigationItem = Readonly<{
  label: string
  href?: string
  icon: LucideIcon
  active?: boolean
}>

export const primaryNavigation: readonly NavigationItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, active: true },
  { label: "Runs", icon: FileSearch },
  { label: "Review queue", icon: ListChecks },
  { label: "Businesses", icon: Building2 },
]

export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Run history", icon: History },
  { label: "Settings", icon: Settings },
]
