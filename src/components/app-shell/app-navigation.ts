import { CheckListIcon, DashboardSquare01Icon, FileSearchIcon } from "@hugeicons/core-free-icons"

export const primaryNavigation = [
  { label: "Overview", href: "/", icon: DashboardSquare01Icon },
  { label: "Runs", href: "/runs", icon: FileSearchIcon },
  { label: "Review Queue", href: "/review", icon: CheckListIcon },
] as const

export type NavigationItem = (typeof primaryNavigation)[number]
