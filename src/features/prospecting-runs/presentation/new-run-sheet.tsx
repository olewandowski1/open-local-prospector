"use client"

import { AlertCircleIcon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/icon"

import { SectionHeader } from "@/components/page-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { SearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import type { SearchBriefPreflight } from "@/features/prospecting-runs/application/search-brief-preflight"
import { RunPreflightSection } from "@/features/prospecting-runs/presentation/run-preflight-panel"
import {
  categoryPresets,
  initialSearchBriefDraft,
  type SearchBriefDraftState,
  serializeSearchBriefDraft,
} from "@/features/prospecting-runs/presentation/search-brief-draft"
import {
  defaultRuntimeExecutionConfiguration,
  type RuntimeId,
  RuntimeProviderIcon,
  type RuntimeReadiness,
  type RuntimeReasoningEffort,
  reasoningEffortLabel,
  resolveRuntimeConfiguration,
  runtimeModelOptions,
  runtimeReasoningEfforts,
} from "@/features/runtime-settings/client"

const fieldSpacing = "gap-1.5"

export type SearchBriefBootstrap = Readonly<{
  defaults?: SearchBriefDefaults
  runtimes: readonly RuntimeReadiness[]
  selectedRuntime?: RuntimeId
}>

/**
 * The whole New Run flow beside whatever page launched it. Mounted fresh by `NewRunProvider`
 * on every open, so a half-written brief never survives closing the panel.
 */
export function NewRunSheet() {
  // Retrying remounts the loader, so every attempt starts from a clean slate.
  const [attempt, setAttempt] = useState(0)

  return (
    <>
      <SheetHeader className="gap-1 p-4 pr-12">
        <SheetTitle>New Prospecting Run</SheetTitle>
        <SheetDescription>
          Define the market, confirm how the location was interpreted, and verify local readiness.
        </SheetDescription>
      </SheetHeader>
      <Separator />
      <NewRunBootstrap key={attempt} onRetry={() => setAttempt((current) => current + 1)} />
    </>
  )
}

function NewRunBootstrap({ onRetry }: { onRetry: () => void }) {
  const [bootstrap, setBootstrap] = useState<SearchBriefBootstrap>()
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoadError("")
    fetch("/api/search-brief/bootstrap")
      .then(async (response) => {
        if (!response.ok) throw new Error("The New Run form could not be loaded.")
        return (await response.json()) as SearchBriefBootstrap
      })
      .then((body) => {
        if (!cancelled) setBootstrap(body)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(
            reason instanceof Error ? reason.message : "The New Run form could not be loaded.",
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <Icon icon={AlertCircleIcon} />
          <AlertTitle>The form could not be loaded</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }
  if (!bootstrap) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading the Search Brief"
        className="grid gap-3 p-4"
      >
        <div className="h-4 w-40 rounded-md bg-muted" />
        <div className="h-8 w-full rounded-lg bg-muted" />
        <div className="h-4 w-52 rounded-md bg-muted" />
        <div className="h-8 w-full rounded-lg bg-muted" />
        <div className="h-8 w-full rounded-lg bg-muted" />
      </div>
    )
  }
  return (
    <SearchBriefForm
      defaults={bootstrap.defaults}
      readyRuntimes={bootstrap.runtimes.filter((runtime) => runtime.status === "Ready")}
      selectedRuntime={bootstrap.selectedRuntime}
    />
  )
}

function SearchBriefForm({
  defaults,
  readyRuntimes,
  selectedRuntime,
}: {
  defaults?: SearchBriefDefaults
  readyRuntimes: readonly RuntimeReadiness[]
  selectedRuntime?: RuntimeId
}) {
  const [draft, setDraft] = useState<SearchBriefDraftState>(() =>
    initialSearchBriefDraft(defaults, readyRuntimes, selectedRuntime),
  )
  const [preflight, setPreflight] = useState<SearchBriefPreflight>()
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [requestId, setRequestId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [createdRun, setCreatedRun] = useState<{ id: string; state: string }>()
  const preflightSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Preflight results appear below the brief; bring them into view where the sticky aside used to.
    if (preflight)
      preflightSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [preflight])

  const runtimeItems = useMemo(
    () => readyRuntimes.map((runtime) => ({ label: runtime.label, value: runtime.runtimeId })),
    [readyRuntimes],
  )
  const categoryItems = categoryPresets.map((category) => ({ label: category, value: category }))
  const selectedEfforts = draft.runtime ? runtimeReasoningEfforts(draft.runtime, draft.model) : []

  const invalidate = (next: Partial<SearchBriefDraftState>) => {
    setDraft((current) => ({ ...current, ...next }))
    setPreflight(undefined)
    setSelectedAreaId("")
    setRequestId("")
    setCreatedRun(undefined)
    setError("")
  }

  const checkPreflight = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setCreatedRun(undefined)
    try {
      const response = await fetch("/api/prospecting-runs/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeSearchBriefDraft(draft)),
      })
      const body = (await response.json()) as SearchBriefPreflight & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Preflight failed.")
      setPreflight(body)
      setSelectedAreaId(body.searchAreas.length === 1 ? (body.searchAreas[0]?.id ?? "") : "")
      setRequestId(crypto.randomUUID())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Preflight failed.")
    } finally {
      setBusy(false)
    }
  }

  const createRun = async () => {
    if (!preflight?.ready || !selectedAreaId || !requestId) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/prospecting-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: serializeSearchBriefDraft(draft),
          searchAreaId: selectedAreaId,
          requestId,
        }),
      })
      const body = (await response.json()) as { id?: string; state?: string; error?: string }
      if (!response.ok || !body.id || !body.state) {
        throw new Error(body.error ?? "The run was not created.")
      }
      setCreatedRun({ id: body.id, state: body.state })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The run was not created.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 p-4">
          {readyRuntimes.length === 0 ? (
            <Alert variant="destructive">
              <Icon icon={AlertCircleIcon} />
              <AlertTitle>No subscription runtime is ready</AlertTitle>
              <AlertDescription>
                <Link href="/settings/subscription">Open Settings</Link> and follow the terminal
                instructions before creating a run.
              </AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="search-scope-heading" className="border-y py-5">
            <SectionHeader
              title={<span id="search-scope-heading">Search Scope</span>}
              description="Poland is assumed when no country is provided. Add a country to search elsewhere."
              className="mb-5"
            />
            <form id="new-run-brief" onSubmit={checkPreflight}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="location">City or Municipality</FieldLabel>
                  <Input
                    id="location"
                    name="location"
                    placeholder="e.g. Kraków or Berlin, Germany"
                    value={draft.location}
                    onChange={(event) => invalidate({ location: event.target.value })}
                    required
                  />
                  <FieldDescription>
                    Search runs only when you choose Check Preflight; there is no location
                    autocomplete.
                  </FieldDescription>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="radius">Radius in Kilometres (Optional)</FieldLabel>
                    <Input
                      id="radius"
                      name="radius"
                      type="number"
                      min="0"
                      step="1"
                      value={draft.radiusKm}
                      onChange={(event) => invalidate({ radiusKm: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="target">Target Businesses</FieldLabel>
                    <Input
                      id="target"
                      name="target"
                      type="number"
                      min="5"
                      max="50"
                      step="1"
                      value={draft.targetCount}
                      onChange={(event) => invalidate({ targetCount: event.target.value })}
                      required
                    />
                    <FieldDescription>Choose any value from 5 through 50.</FieldDescription>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="category">Business Category</FieldLabel>
                  <Select
                    items={categoryItems}
                    value={draft.categoryChoice}
                    onValueChange={(value) => value && invalidate({ categoryChoice: value })}
                  >
                    <SelectTrigger id="category" aria-label="Business category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[...categoryPresets].map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {draft.categoryChoice === "Custom category" ? (
                  <Field>
                    <FieldLabel htmlFor="custom-category">Custom Category</FieldLabel>
                    <Input
                      id="custom-category"
                      value={draft.customCategory}
                      onChange={(event) => invalidate({ customCategory: event.target.value })}
                      placeholder="e.g. Independent climbing gyms"
                      required
                    />
                  </Field>
                ) : null}

                <FieldSet>
                  <FieldLegend>Run Mode</FieldLegend>
                  <RadioGroup
                    value={draft.mode}
                    onValueChange={(value) =>
                      value && invalidate({ mode: value as SearchBriefDraftState["mode"] })
                    }
                    className="grid sm:grid-cols-2"
                  >
                    {(["Quick", "Thorough"] as const).map((mode) => (
                      <FieldLabel key={mode}>
                        <Field orientation="horizontal">
                          <RadioGroupItem value={mode} aria-label={mode} />
                          <div>
                            <p className="font-medium">{mode}</p>
                            <p className="text-xs text-muted-foreground">
                              {mode === "Quick"
                                ? "Faster initial qualification"
                                : "More sources and evidence"}
                            </p>
                          </div>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor="recent-business-policy">
                    Recently Assessed Businesses
                  </FieldLabel>
                  <Select
                    items={[
                      { label: "Skip by default", value: "Skip" },
                      {
                        label: "Include existing assessment",
                        value: "IncludeWithoutReassessment",
                      },
                      { label: "Explicitly reassess", value: "Reassess" },
                    ]}
                    value={draft.recentBusinessPolicy}
                    onValueChange={(value) =>
                      value &&
                      invalidate({
                        recentBusinessPolicy:
                          value as SearchBriefDraftState["recentBusinessPolicy"],
                      })
                    }
                  >
                    <SelectTrigger
                      id="recent-business-policy"
                      aria-label="Recently Assessed Businesses"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Skip">Skip by default</SelectItem>
                        <SelectItem value="IncludeWithoutReassessment">
                          Include existing assessment
                        </SelectItem>
                        <SelectItem value="Reassess">Explicitly reassess</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Reassessment is always an explicit choice and never overwrites history.
                  </FieldDescription>
                </Field>

                <Field className={fieldSpacing}>
                  <FieldLabel htmlFor="runtime">Subscription Runtime</FieldLabel>
                  <Select
                    items={runtimeItems}
                    value={draft.runtime}
                    onValueChange={(value) =>
                      value &&
                      invalidate({
                        runtime: value as RuntimeId,
                        ...defaultRuntimeExecutionConfiguration(value as RuntimeId),
                      })
                    }
                  >
                    <SelectTrigger
                      id="runtime"
                      aria-label="Subscription Runtime"
                      className="w-full"
                      disabled={!runtimeItems.length}
                    >
                      <SelectValue placeholder="No ready runtime">
                        {(value: string | null) => {
                          const runtime = readyRuntimes.find((item) => item.runtimeId === value)
                          if (!runtime) return "No ready runtime"
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
                        {readyRuntimes.map((runtime) => (
                          <SelectItem key={runtime.runtimeId} value={runtime.runtimeId}>
                            <RuntimeProviderIcon runtimeId={runtime.runtimeId} />
                            {runtime.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {draft.runtime ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field className={fieldSpacing}>
                      <FieldLabel htmlFor="runtime-model">Model</FieldLabel>
                      <Select
                        items={runtimeModelOptions(draft.runtime).map((model) => ({
                          label: model.label,
                          value: model.value,
                        }))}
                        value={draft.model}
                        onValueChange={(value) =>
                          value &&
                          draft.runtime &&
                          invalidate(
                            resolveRuntimeConfiguration(
                              draft.runtime,
                              value,
                              draft.reasoningEffort,
                            ),
                          )
                        }
                      >
                        <SelectTrigger id="runtime-model" aria-label="Model" className="w-full">
                          <SelectValue>
                            {(value: string | null) => (
                              <>
                                {draft.runtime ? (
                                  <RuntimeProviderIcon runtimeId={draft.runtime} />
                                ) : null}
                                {runtimeModelOptions(draft.runtime as RuntimeId).find(
                                  (model) => model.value === value,
                                )?.label ?? "Select a model"}
                              </>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {runtimeModelOptions(draft.runtime).map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                {draft.runtime ? (
                                  <RuntimeProviderIcon runtimeId={draft.runtime} />
                                ) : null}
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        {runtimeModelOptions(draft.runtime).find(
                          (model) => model.value === draft.model,
                        )?.detail ?? "The selected model ID is pinned for this run."}
                      </FieldDescription>
                    </Field>
                    <Field className={fieldSpacing}>
                      <FieldLabel htmlFor="reasoning-effort">Reasoning Effort</FieldLabel>
                      {selectedEfforts.length === 0 ? (
                        <div
                          id="reasoning-effort"
                          className="flex h-8 items-center rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground"
                        >
                          Not applicable
                        </div>
                      ) : (
                        <Select
                          items={selectedEfforts.map((effort) => ({
                            label: reasoningEffortLabel(effort),
                            value: effort,
                          }))}
                          value={draft.reasoningEffort}
                          onValueChange={(value) =>
                            value &&
                            invalidate({ reasoningEffort: value as RuntimeReasoningEffort })
                          }
                        >
                          <SelectTrigger id="reasoning-effort" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {selectedEfforts.map((effort) => (
                                <SelectItem key={effort} value={effort}>
                                  {reasoningEffortLabel(effort)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                      <FieldDescription>
                        {selectedEfforts.length === 0
                          ? "This model does not accept a reasoning effort."
                          : "Higher effort spends more subscription usage per run."}
                      </FieldDescription>
                    </Field>
                  </div>
                ) : null}
              </FieldGroup>
            </form>
          </section>

          <div ref={preflightSectionRef} className="scroll-mt-2">
            <RunPreflightSection
              preflight={preflight}
              selectedAreaId={selectedAreaId}
              onSelectedAreaChange={setSelectedAreaId}
              error={error}
              busy={busy}
              createdRun={createdRun}
              onCreateRun={createRun}
            />
          </div>
        </div>
      </ScrollArea>

      {!preflight && !createdRun ? (
        <SheetFooter className="flex-row items-center justify-end gap-3 border-t p-3">
          <Button type="submit" form="new-run-brief" disabled={busy || !draft.runtime}>
            {busy ? (
              <Icon icon={Loading03Icon} className="animate-spin" />
            ) : (
              <Icon icon={Search01Icon} />
            )}
            Check Preflight
          </Button>
        </SheetFooter>
      ) : null}
    </>
  )
}
