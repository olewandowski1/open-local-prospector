"use client"

import { Bell, MoreHorizontal, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import {
  type NavigationItem,
  primaryNavigation,
  secondaryNavigation,
} from "@/components/app-shell/app-navigation"
import { UserMenu } from "@/components/app-shell/user-menu"
import { useWorkspaceCommand, WorkspaceCommand } from "@/components/app-shell/workspace-command"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
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
} from "@/components/ui/sidebar"

function NavigationGroup({ label, items }: { label: string; items: readonly NavigationItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              {item.href ? (
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton disabled tooltip={`${item.label} · Coming soon`}>
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const command = useWorkspaceCommand()
  const pathname = usePathname()
  const currentPage =
    pathname === "/settings" ? "Settings" : pathname === "/runs/new" ? "New run" : "Overview"

  return (
    <SidebarProvider defaultOpen className="min-h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-10 items-center gap-2 px-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles aria-hidden="true" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold leading-none">Local Prospector</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Find businesses worth helping
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavigationGroup label="Workspace" items={primaryNavigation} />
          <NavigationGroup label="System" items={secondaryNavigation} />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 p-1">
            <Avatar className="size-8">
              <AvatarFallback>OK</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-semibold">Oliver</p>
              <p className="truncate text-[10px] text-muted-foreground">Local workspace</p>
            </div>
            <UserMenu
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open user menu"
                  className="group-data-[collapsible=icon]:hidden"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              }
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <SidebarTrigger />
          <div className="hidden items-center gap-2 text-xs sm:flex">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{currentPage}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden w-56 justify-start text-muted-foreground sm:flex"
              onClick={() => command.setOpen(true)}
            >
              <Search data-icon="inline-start" aria-hidden="true" />
              <span className="flex-1 text-left">Search</span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
              <Bell aria-hidden="true" />
            </Button>
            <UserMenu
              trigger={
                <Button variant="ghost" size="icon" aria-label="Open user menu">
                  <Avatar className="size-8">
                    <AvatarFallback>OK</AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
          </div>
        </header>
        {children}
      </SidebarInset>

      <WorkspaceCommand open={command.open} onOpenChange={command.setOpen} />
    </SidebarProvider>
  )
}
