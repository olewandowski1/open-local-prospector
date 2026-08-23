"use client"

import { Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { type NavigationItem, primaryNavigation } from "@/components/app-shell/app-navigation"
import { useWorkspaceCommand, WorkspaceCommand } from "@/components/app-shell/workspace-command"
import { BrandMark } from "@/components/brand-mark"
import { IconButton, IconLink } from "@/components/icon-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/features/local-application/presentation/theme-toggle"
import { NewRunProvider } from "@/features/prospecting-runs/client"
import { RuntimeUpdatePanel } from "@/features/runtime-settings/presentation/runtime-update-panel"

function NavigationGroup({ label, items }: { label: string; items: readonly NavigationItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                tooltip={item.label}
                render={<Link href={item.href} />}
              >
                <HugeiconsIcon icon={item.icon} aria-hidden="true" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function WorkspaceSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Search Workspace" variant="subtle" size="icon-sm" onClick={onClick}>
      <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
    </IconButton>
  )
}

function SidebarRestoreTrigger() {
  const { open } = useSidebar()

  if (open) {
    return null
  }

  return <SidebarTrigger className="hidden md:inline-flex" />
}

export function AppShell({ children }: { children: ReactNode }) {
  const command = useWorkspaceCommand()
  const pathname = usePathname()
  const currentPage =
    pathname === "/"
      ? "Overview"
      : pathname.startsWith("/settings")
        ? "Settings"
        : pathname === "/review"
          ? "Candidates"
          : pathname.startsWith("/runs/")
            ? "Run Detail"
            : pathname === "/runs"
              ? "Runs"
              : "Workspace"

  return (
    <SidebarProvider defaultOpen className="h-svh overflow-hidden">
      <NewRunProvider>
        <Sidebar collapsible="offcanvas" className="app-sidebar-gradient">
          <SidebarHeader>
            <div className="flex h-10 items-center justify-between gap-2 px-2">
              <Link
                href="/"
                className="flex min-w-0 items-center gap-2 font-heading text-sm font-semibold"
              >
                <BrandMark className="size-5 text-sidebar-primary" />
                <span className="truncate">Open Prospector</span>
              </Link>
              <div className="ml-auto flex items-center gap-1">
                <WorkspaceSearchTrigger onClick={() => command.setOpen(true)} />
                <SidebarTrigger />
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <NavigationGroup label="Workspace" items={primaryNavigation} />
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-1">
              <IconLink label="Settings" href="/settings/general" variant="subtle" size="icon-sm">
                <HugeiconsIcon icon={Settings02Icon} aria-hidden="true" />
              </IconLink>
              <RuntimeUpdatePanel />
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="h-full min-h-0 overflow-hidden [--shell-header:2.75rem]">
          <header className="flex h-(--shell-header) shrink-0 items-center gap-3 border-b px-3 sm:px-4">
            <SidebarTrigger className="md:hidden" />
            <SidebarRestoreTrigger />
            <div className="hidden items-center gap-2 text-xs sm:flex">
              <span className="text-muted-foreground">Workspace</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{currentPage}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>

        <WorkspaceCommand open={command.open} onOpenChange={command.setOpen} />
      </NewRunProvider>
    </SidebarProvider>
  )
}
