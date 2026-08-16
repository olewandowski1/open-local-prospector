"use client"

import * as React from "react"
import type { ReactElement } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Building2,
  CircleCheck,
  Clock3,
  Download,
  FileSearch,
  Globe2,
  History,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
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

type NavigationItem = {
  label: string
  icon: LucideIcon
  active?: boolean
}

const primaryNavigation: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Runs", icon: FileSearch },
  { label: "Review queue", icon: ListChecks },
  { label: "Businesses", icon: Building2 },
]

const secondaryNavigation: NavigationItem[] = [
  { label: "Run history", icon: History },
  { label: "Settings", icon: Settings },
]

const stats = [
  { label: "Businesses found", value: "184", note: "+32 this week" },
  { label: "Strong candidates", value: "47", note: "26% qualify" },
  { label: "Awaiting review", value: "18", note: "6 high priority" },
  { label: "Active scans", value: "2", note: "Kraków & Gdańsk" },
]

const recentRuns = [
  {
    location: "Kraków",
    category: "Dental clinics",
    found: 38,
    candidates: 12,
    status: "Complete",
    time: "12 min ago",
  },
  {
    location: "Gdańsk",
    category: "Interior designers",
    found: 24,
    candidates: 7,
    status: "Analyzing",
    time: "Now",
  },
  {
    location: "Wrocław",
    category: "Physiotherapy",
    found: 42,
    candidates: 15,
    status: "Complete",
    time: "Yesterday",
  },
]

const candidates = [
  { name: "Studio Forma", location: "Kraków", score: 91, reason: "No website found" },
  { name: "Dentica Plus", location: "Kraków", score: 84, reason: "Outdated, non-mobile site" },
  { name: "Meble Północ", location: "Gdańsk", score: 78, reason: "Social-only presence" },
]

function UserMenu({ trigger }: { trigger: ReactElement }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings aria-hidden="true" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Runtime: Codex CLI</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavigationGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton isActive={item.active} tooltip={item.label} render={<a href="#" />}>
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export default function AppShellBlock() {
  const [commandOpen, setCommandOpen] = React.useState(false)

  React.useEffect(() => {
    function openCommandMenu(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", openCommandMenu)
    return () => document.removeEventListener("keydown", openCommandMenu)
  }, [])

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
              <p className="mt-1 text-[10px] text-muted-foreground">Find businesses worth helping</p>
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
                <Button variant="ghost" size="icon-sm" aria-label="Open user menu" className="group-data-[collapsible=icon]:hidden">
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
            <span className="font-medium">Overview</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="hidden w-56 justify-start text-muted-foreground sm:flex" onClick={() => setCommandOpen(true)}>
              <Search aria-hidden="true" />
              <span className="flex-1 text-left">Search</span>
              <KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell aria-hidden="true" />
            </Button>
            <UserMenu
              trigger={
                <Button variant="ghost" size="icon" aria-label="Open user menu">
                  <Avatar className="size-8"><AvatarFallback>OK</AvatarFallback></Avatar>
                </Button>
              }
            />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3">Local-first workspace</Badge>
              <h1 className="font-heading text-2xl font-bold tracking-tight">Good morning, Oliver</h1>
              <p className="mt-1 text-sm text-muted-foreground">Review promising local businesses or start a focused scan.</p>
            </div>
            <Button><Plus aria-hidden="true" />New prospecting run</Button>
          </div>

          <section aria-label="Prospecting summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} size="sm">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
                </CardHeader>
                <CardFooter className="text-xs text-muted-foreground">{stat.note}</CardFooter>
              </Card>
            ))}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Recent runs</CardTitle>
                <CardDescription>Discovery and analysis jobs from this workspace.</CardDescription>
                <CardAction><Button variant="ghost" size="sm">View all</Button></CardAction>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-4">
                  {recentRuns.map((run) => (
                    <li key={`${run.location}-${run.category}`} className="flex items-center gap-3 border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {run.status === "Complete" ? <CircleCheck aria-hidden="true" /> : <Play aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{run.category}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin aria-hidden="true" />{run.location} · {run.found} found · {run.candidates} candidates</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={run.status === "Complete" ? "secondary" : "outline"}>{run.status}</Badge>
                        <p className="mt-1 text-[10px] text-muted-foreground">{run.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Top candidates</CardTitle>
                <CardDescription>Highest deterministic opportunity scores.</CardDescription>
                <CardAction><Button variant="ghost" size="sm">Review</Button></CardAction>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-4">
                  {candidates.map((candidate) => (
                    <li key={candidate.name}>
                      <Progress value={candidate.score} className="gap-2">
                        <div className="flex w-full items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <ProgressLabel className="truncate text-sm font-medium text-foreground">{candidate.name}</ProgressLabel>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{candidate.location} · {candidate.reason}</p>
                          </div>
                          <ProgressValue className="w-10 text-right font-semibold" />
                        </div>
                      </Progress>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="border-t">
                <Button variant="outline" className="w-full"><Download aria-hidden="true" />Export shortlist</Button>
              </CardFooter>
            </Card>
          </section>

          <Card className="mt-4 bg-muted/30">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background shadow-sm"><Globe2 aria-hidden="true" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Ready for another market?</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a Polish location, category, depth, and AI runtime. Public sources only.</p>
              </div>
              <Button variant="outline"><Clock3 aria-hidden="true" />Start quick scan</Button>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput aria-label="Search workspace" placeholder="Search businesses, runs, or actions…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {[...primaryNavigation, ...secondaryNavigation].map((item) => (
                <CommandItem key={item.label} onSelect={() => setCommandOpen(false)}>
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => setCommandOpen(false)}><Plus aria-hidden="true" /><span>Start a new run</span></CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </SidebarProvider>
  )
}
