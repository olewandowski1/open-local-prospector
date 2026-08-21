"use client"

import { Check, CircleAlert, LoaderCircle, Settings2, X } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  defaultRuntimeExecutionConfiguration,
  type RuntimeId,
  RuntimeProviderIcon,
  type RuntimeReadiness,
  type RuntimeReasoningEffort,
  resolveRuntimeConfiguration,
  runtimeModelOptions,
  runtimeReasoningEfforts,
} from "@/features/runtime-settings/client"
import { cn } from "@/lib/utils"

/**
 * The workspace-wide runtime, model, and reasoning effort that seed every new Prospecting Run.
 */
export type RuntimeSteering = Readonly<{
  runtimeId: RuntimeId
  model: string
  reasoningEffort: RuntimeReasoningEffort
}>

/** Keeps a label, its control, and its description reading as one field. */
const fieldSpacing = "gap-1.5"

const steeringOf = (runtimeId: RuntimeId): RuntimeSteering => ({
  runtimeId,
  ...defaultRuntimeExecutionConfiguration(runtimeId),
})

const isSameSteering = (left: RuntimeSteering, right?: RuntimeSteering) =>
  left.runtimeId === right?.runtimeId &&
  left.model === right.model &&
  left.reasoningEffort === right.reasoningEffort

export function RuntimeSteeringPanel({
  runtimes,
  steering,
  saveSteering,
}: {
  runtimes: readonly RuntimeReadiness[]
  steering?: RuntimeSteering
  saveSteering: (steering: RuntimeSteering) => Promise<void>
}) {
  const readyRuntimes = runtimes.filter((runtime) => runtime.status === "Ready")
  const fallbackRuntime = readyRuntimes[0]?.runtimeId
  const [draft, setDraft] = useState<RuntimeSteering | undefined>(
    steering ?? (fallbackRuntime ? steeringOf(fallbackRuntime) : undefined),
  )
  const [saved, setSaved] = useState(steering)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const selectedRuntime = runtimes.find((runtime) => runtime.runtimeId === draft?.runtimeId)
  const models = draft ? runtimeModelOptions(draft.runtimeId) : []
  const efforts = draft ? runtimeReasoningEfforts(draft.runtimeId, draft.model) : []
  const unchanged = draft !== undefined && isSameSteering(draft, saved)

  const selectModel = (model: string) =>
    setDraft(
      (current) =>
        current && {
          runtimeId: current.runtimeId,
          ...resolveRuntimeConfiguration(current.runtimeId, model, current.reasoningEffort),
        },
    )

  const save = () => {
    if (!draft) return
    setError("")
    startTransition(async () => {
      try {
        await saveSteering(draft)
        setSaved(draft)
      } catch {
        setError("The steering choice could not be stored locally.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight">Run Steering</h2>
            {selectedRuntime ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-sm",
                  selectedRuntime.status === "Ready" ? "text-success" : "text-destructive",
                )}
              >
                {selectedRuntime.status === "Ready" ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <X className="size-3.5" aria-hidden="true" />
                )}
                {selectedRuntime.status === "Ready" ? "Ready" : "Not Ready"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            The runtime, model, and reasoning effort that new prospecting runs start from. Provider
            logins stay in their own terminals.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {draft ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="steering-runtime">Subscription Runtime</FieldLabel>
              <Select
                items={runtimes.map((runtime) => ({
                  label: runtime.label,
                  value: runtime.runtimeId,
                }))}
                value={draft.runtimeId}
                onValueChange={(value) => value && setDraft(steeringOf(value as RuntimeId))}
              >
                <SelectTrigger
                  id="steering-runtime"
                  aria-label="Subscription Runtime"
                  className="w-full"
                >
                  <SelectValue>
                    {(value: string | null) => {
                      const runtime = runtimes.find((item) => item.runtimeId === value)
                      if (!runtime) return "Select a runtime"
                      return (
                        <>
                          <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                          {runtime.label}
                        </>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {runtimes.map((runtime) => (
                      <SelectItem
                        key={runtime.runtimeId}
                        value={runtime.runtimeId}
                        disabled={runtime.status !== "Ready"}
                      >
                        <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                        {runtime.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Only authenticated runtimes can be selected.</FieldDescription>
            </Field>

            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="steering-model">Model</FieldLabel>
              <Select
                items={models.map((model) => ({ label: model.label, value: model.value }))}
                value={draft.model}
                onValueChange={(value) => value && selectModel(value)}
              >
                <SelectTrigger id="steering-model" aria-label="Model" className="w-full">
                  <SelectValue>
                    {(value: string | null) => (
                      <>
                        <RuntimeProviderIcon runtimeId={draft.runtimeId} />
                        {models.find((model) => model.value === value)?.label ?? "Select a model"}
                      </>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {models.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <RuntimeProviderIcon runtimeId={draft.runtimeId} />
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {models.find((model) => model.value === draft.model)?.detail ??
                  "Choose the model this workspace should default to."}
              </FieldDescription>
            </Field>

            <Field className={fieldSpacing}>
              <FieldLabel htmlFor="steering-effort">Reasoning Effort</FieldLabel>
              {efforts.length === 0 ? (
                <div
                  id="steering-effort"
                  className="flex h-8 items-center rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground"
                >
                  Not applicable
                </div>
              ) : (
                <Select
                  items={efforts.map((effort) => ({ label: effort, value: effort }))}
                  value={draft.reasoningEffort}
                  onValueChange={(value) =>
                    value &&
                    setDraft(
                      (current) =>
                        current && { ...current, reasoningEffort: value as RuntimeReasoningEffort },
                    )
                  }
                >
                  <SelectTrigger
                    id="steering-effort"
                    aria-label="Reasoning Effort"
                    className="w-full capitalize"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {efforts.map((effort) => (
                        <SelectItem className="capitalize" key={effort} value={effort}>
                          {effort}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <FieldDescription>
                {efforts.length === 0
                  ? "This model does not accept a reasoning effort."
                  : "Higher effort spends more usage per run."}
              </FieldDescription>
            </Field>
          </div>
        ) : (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>No Authenticated Runtime</AlertTitle>
            <AlertDescription>
              Sign in to Codex or Claude in their terminals, then confirm readiness in settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={!draft || pending || unchanged}>
            {pending ? <LoaderCircle data-icon="inline-start" aria-hidden="true" /> : null}
            Save Steering
          </Button>
          <Link href="/settings/subscription" className={buttonVariants({ variant: "ghost" })}>
            <Settings2 data-icon="inline-start" aria-hidden="true" />
            Runtime Settings
          </Link>
          <p role="status" className="text-xs text-muted-foreground">
            {error}
          </p>
        </div>
      </div>
    </div>
  )
}
