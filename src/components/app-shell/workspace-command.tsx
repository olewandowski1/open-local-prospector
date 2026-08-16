"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { primaryNavigation, secondaryNavigation } from "@/components/app-shell/app-navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export function useWorkspaceCommand() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
  return { open, setOpen }
}

export function WorkspaceCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const navigate = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput
          aria-label="Search workspace"
          placeholder="Search businesses, runs, or actions…"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {[...primaryNavigation, ...secondaryNavigation].map((item) => {
              const href = item.href
              return (
                <CommandItem
                  key={item.label}
                  disabled={!href}
                  onSelect={href ? () => navigate(href) : undefined}
                >
                  <item.icon aria-hidden="true" />
                  <span>
                    {item.label}
                    {href ? "" : " · Coming soon"}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => navigate("/runs/new")}>
              <Plus aria-hidden="true" />
              <span>Start a new run</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
