"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"
import { Icon } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { NewRunSheet } from "@/features/prospecting-runs/presentation/new-run-sheet"

const NewRunContext = createContext<{ open: () => void }>({ open: () => {} })

export function useNewRun() {
  return useContext(NewRunContext)
}

export function NewRunProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Each open remounts the sheet body, so a half-written brief never survives a close.
  const [instance, setInstance] = useState(0)
  const value = useMemo(
    () => ({
      open: () => {
        setInstance((current) => current + 1)
        setOpen(true)
      },
    }),
    [],
  )

  return (
    <NewRunContext.Provider value={value}>
      {children}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(false)
        }}
      >
        {/* Mounted only while open; the key makes every open a fresh brief. */}
        {open ? (
          <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
            <NewRunSheet key={instance} />
          </SheetContent>
        ) : null}
      </Sheet>
    </NewRunContext.Provider>
  )
}

type NewRunButtonProps = Readonly<{
  size?: ComponentProps<typeof Button>["size"]
  variant?: ComponentProps<typeof Button>["variant"]
  className?: string
}>

/** Renderable from server pages; opens the shared New Run sheet on click. */
export function NewRunButton({ size, variant, className }: NewRunButtonProps) {
  const { open } = useNewRun()
  return (
    <Button size={size} variant={variant} className={className} onClick={open}>
      <Icon icon={Add01Icon} data-icon="inline-start" />
      New Run
    </Button>
  )
}
