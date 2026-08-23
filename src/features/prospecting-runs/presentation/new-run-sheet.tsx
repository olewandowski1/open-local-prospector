"use client"

import {
  AlertCircleIcon,
  Loading03Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/icon"
import { InfoButton } from "@/components/info-button"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
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
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
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

const fieldSpacing = "gap-1"

const categoryLabels: Record<(typeof categoryPresets)[number], string> = {
  "Dental clinics": "Dental Clinics",
  Restaurants: "Restaurants",
  "Beauty salons": "Beauty Salons",
  "Construction companies": "Construction Companies",
  "Law firms": "Law Firms",
  "Custom category": "Custom Category",
}

const skeletonFieldIds = ["primary", "secondary", "tertiary"] as const

function FormSectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <InfoButton description={description} />
    </div>
  )
}

function FieldHeading({
  htmlFor,
  label,
  description,
}: {
  htmlFor: string
  label: string
  description: string
}) {
  return (
    <div className="flex items-center gap-1">
      <FieldLabel htmlFor={htmlFor} className="font-normal">
        {label}
      </FieldLabel>
      <InfoButton description={description} />
    </div>
  )
}

function FormSkeletonSection({ fields = 2 }: { fields?: number }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <div className="grid gap-4">
        {skeletonFieldIds.slice(0, fields).map((fieldId) => (
          <div key={fieldId} className="grid gap-1">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="size-3.5 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  )
}

function RuntimeFieldsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Checking Subscription Runtimes"
      className="grid gap-4"
    >
      <div className="grid gap-1">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="grid gap-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export type SearchBriefBootstrap = Readonly<{
  defaults?: SearchBriefDefaults
  selectedRuntime?: RuntimeId
}>

type RuntimeOptions = Readonly<{ runtimes: readonly RuntimeReadiness[] }>

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
      <NewRunBootstrap key={attempt} onRetry={() => setAttempt((current) => current + 1)} />
    </>
  )
}

function NewRunBootstrap({ onRetry }: { onRetry: () => void }) {
  const [bootstrap, setBootstrap] = useState<SearchBriefBootstrap>()
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOptions>()
  const [loadError, setLoadError] = useState("")
  const [runtimeError, setRuntimeError] = useState("")

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
    fetch("/api/search-brief/runtimes")
      .then(async (response) => {
        if (!response.ok) throw new Error("Subscription runtimes could not be checked.")
        return (await response.json()) as RuntimeOptions
      })
      .then((body) => {
        if (!cancelled) setRuntimeOptions(body)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setRuntimeError(
            reason instanceof Error
              ? reason.message
              : "Subscription runtimes could not be checked.",
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
          <AlertTitle>The Form Could Not Be Loaded</AlertTitle>
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
      <>
        <ScrollArea className="min-h-0 flex-1">
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading The Search Brief"
            className="grid gap-8 px-4 pb-6 pt-2"
          >
            <FormSkeletonSection fields={3} />
            <FormSkeletonSection fields={2} />
            <FormSkeletonSection fields={2} />
          </div>
        </ScrollArea>
        <SheetFooter className="border-t p-3">
          <Skeleton className="h-8 w-full rounded-lg" />
        </SheetFooter>
      </>
    )
  }
  return (
    <SearchBriefForm
      defaults={bootstrap.defaults}
      readyRuntimes={runtimeOptions?.runtimes.filter((runtime) => runtime.status === "Ready") ?? []}
      runtimeLoading={!runtimeOptions && !runtimeError}
      runtimeError={runtimeError}
      selectedRuntime={bootstrap.selectedRuntime}
    />
  )
}

function SearchBriefForm({
  defaults,
  readyRuntimes,
  runtimeLoading,
  runtimeError,
  selectedRuntime,
}: {
  defaults?: SearchBriefDefaults
  readyRuntimes: readonly RuntimeReadiness[]
  runtimeLoading: boolean
  runtimeError: string
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
  const preferredRuntime = readyRuntimes.some((runtime) => runtime.runtimeId === selectedRuntime)
    ? selectedRuntime
    : readyRuntimes[0]?.runtimeId
  const effectiveDraft = useMemo<SearchBriefDraftState>(() => {
    if (draft.runtime || !preferredRuntime) return draft
    return {
      ...draft,
      runtime: preferredRuntime,
      ...defaultRuntimeExecutionConfiguration(preferredRuntime),
    }
  }, [draft, preferredRuntime])
  const categoryItems = categoryPresets.map((category) => ({
    label: categoryLabels[category],
    value: category,
  }))
  const selectedEfforts = effectiveDraft.runtime
    ? runtimeReasoningEfforts(effectiveDraft.runtime, effectiveDraft.model)
    : []

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
        body: JSON.stringify(serializeSearchBriefDraft(effectiveDraft)),
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
          draft: serializeSearchBriefDraft(effectiveDraft),
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
        <div className="grid gap-8 px-4 pb-6 pt-2">
          <section aria-labelledby="search-scope-heading">
            <div id="search-scope-heading">
              <FormSectionHeading
                title="Search Criteria"
                description="Choose the market and the number of businesses to find. Poland is assumed unless you include another country."
              />
            </div>
            <form id="new-run-brief" onSubmit={checkPreflight}>
              <FieldGroup className="mt-4 gap-4 [&_[data-slot=field]]:gap-1 [&_[data-slot=field-label]]:font-normal">
                <Field>
                  <FieldHeading
                    htmlFor="location"
                    label="City Or Municipality"
                    description="Include a country when searching outside Poland. The location is checked before the run is created."
                  />
                  <Input
                    id="location"
                    name="location"
                    placeholder="e.g. Kraków or Berlin, Germany"
                    value={effectiveDraft.location}
                    onChange={(event) => invalidate({ location: event.target.value })}
                    required
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldHeading
                      htmlFor="radius"
                      label="Radius In Kilometres (Optional)"
                      description="Leave blank to search within the place itself."
                    />
                    <Input
                      id="radius"
                      name="radius"
                      type="number"
                      min="0"
                      step="1"
                      value={effectiveDraft.radiusKm}
                      onChange={(event) => invalidate({ radiusKm: event.target.value })}
                      placeholder="City Limits"
                    />
                  </Field>
                  <Field>
                    <FieldHeading
                      htmlFor="target"
                      label="Target Businesses"
                      description="Choose any value from 5 through 50."
                    />
                    <Input
                      id="target"
                      name="target"
                      type="number"
                      min="5"
                      max="50"
                      step="1"
                      value={effectiveDraft.targetCount}
                      onChange={(event) => invalidate({ targetCount: event.target.value })}
                      required
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="category" className="font-normal">
                    Business Category
                  </FieldLabel>
                  <Select
                    items={categoryItems}
                    value={effectiveDraft.categoryChoice}
                    onValueChange={(value) => value && invalidate({ categoryChoice: value })}
                  >
                    <SelectTrigger id="category" aria-label="Business Category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[...categoryPresets].map((category) => (
                          <SelectItem key={category} value={category}>
                            {categoryLabels[category]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {effectiveDraft.categoryChoice === "Custom category" ? (
                  <Field>
                    <FieldLabel htmlFor="custom-category" className="font-normal">
                      Custom Category
                    </FieldLabel>
                    <Input
                      id="custom-category"
                      value={effectiveDraft.customCategory}
                      onChange={(event) => invalidate({ customCategory: event.target.value })}
                      placeholder="e.g. Independent Climbing Gyms"
                      required
                    />
                  </Field>
                ) : null}

                <FormSectionHeading
                  title="Run Settings"
                  description="Choose how deeply to search and how to handle businesses assessed before."
                />

                <FieldSet className="gap-1">
                  <FieldLegend variant="label" className="font-normal">
                    Run Mode
                  </FieldLegend>
                  <RadioGroup
                    value={effectiveDraft.mode}
                    onValueChange={(value) =>
                      value && invalidate({ mode: value as SearchBriefDraftState["mode"] })
                    }
                    className="flex h-8 w-52 max-w-full gap-0 overflow-hidden rounded-lg border border-input bg-transparent dark:bg-input/20"
                  >
                    {(["Quick", "Thorough"] as const).map((mode) => (
                      <label
                        key={mode}
                        htmlFor={`run-mode-${mode.toLowerCase()}`}
                        className="block h-full min-w-0 flex-1 cursor-pointer"
                      >
                        <RadioGroupItem
                          id={`run-mode-${mode.toLowerCase()}`}
                          value={mode}
                          aria-label={mode}
                          className="peer absolute! size-px! overflow-hidden border-0! p-0! opacity-0"
                        />
                        <span className="flex h-full w-full items-center justify-center gap-1.5 px-3 text-sm leading-normal text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground peer-data-checked:bg-muted peer-data-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-ring/50">
                          <Icon
                            icon={Tick02Icon}
                            className={
                              effectiveDraft.mode === mode
                                ? "size-3.5 text-success"
                                : "invisible size-3.5"
                            }
                          />
                          <span>{mode}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </FieldSet>

                <Field>
                  <FieldHeading
                    htmlFor="recent-business-policy"
                    label="Recently Assessed Businesses"
                    description="Reassessment is always an explicit choice and never overwrites history."
                  />
                  <Select
                    items={[
                      { label: "Skip By Default", value: "Skip" },
                      {
                        label: "Include Existing Assessment",
                        value: "IncludeWithoutReassessment",
                      },
                      { label: "Explicitly Reassess", value: "Reassess" },
                    ]}
                    value={effectiveDraft.recentBusinessPolicy}
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
                        <SelectItem value="Skip">Skip By Default</SelectItem>
                        <SelectItem value="IncludeWithoutReassessment">
                          Include Existing Assessment
                        </SelectItem>
                        <SelectItem value="Reassess">Explicitly Reassess</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <FormSectionHeading
                  title="Subscription Runtime"
                  description="Use a ready local subscription and choose how much reasoning to apply."
                />

                {runtimeLoading ? (
                  <RuntimeFieldsSkeleton />
                ) : (
                  <>
                    {runtimeError ? (
                      <Alert variant="destructive">
                        <Icon icon={AlertCircleIcon} />
                        <AlertTitle>Runtime Check Failed</AlertTitle>
                        <AlertDescription>{runtimeError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {!runtimeError && readyRuntimes.length === 0 ? (
                      <Alert variant="destructive">
                        <Icon icon={AlertCircleIcon} />
                        <AlertTitle>No Subscription Runtime Is Ready</AlertTitle>
                        <AlertDescription>
                          <Link href="/settings/subscription">Open Settings</Link> and follow the
                          terminal instructions before creating a run.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <Field className={fieldSpacing}>
                      <FieldLabel htmlFor="runtime" className="font-normal">
                        Provider
                      </FieldLabel>
                      <Select
                        items={runtimeItems}
                        value={effectiveDraft.runtime}
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
                          <SelectValue placeholder="No Ready Runtime">
                            {(value: string | null) => {
                              const runtime = readyRuntimes.find((item) => item.runtimeId === value)
                              if (!runtime) return "No Ready Runtime"
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

                    {effectiveDraft.runtime ? (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field className={fieldSpacing}>
                          <FieldHeading
                            htmlFor="runtime-model"
                            label="Model"
                            description={
                              runtimeModelOptions(effectiveDraft.runtime).find(
                                (model) => model.value === effectiveDraft.model,
                              )?.detail ?? "The selected model ID is pinned for this run."
                            }
                          />
                          <Select
                            items={runtimeModelOptions(effectiveDraft.runtime).map((model) => ({
                              label: model.label,
                              value: model.value,
                            }))}
                            value={effectiveDraft.model}
                            onValueChange={(value) =>
                              value &&
                              effectiveDraft.runtime &&
                              invalidate(
                                resolveRuntimeConfiguration(
                                  effectiveDraft.runtime,
                                  value,
                                  effectiveDraft.reasoningEffort,
                                ),
                              )
                            }
                          >
                            <SelectTrigger id="runtime-model" aria-label="Model" className="w-full">
                              <SelectValue>
                                {(value: string | null) => (
                                  <>
                                    {effectiveDraft.runtime ? (
                                      <RuntimeProviderIcon runtimeId={effectiveDraft.runtime} />
                                    ) : null}
                                    {runtimeModelOptions(effectiveDraft.runtime as RuntimeId).find(
                                      (model) => model.value === value,
                                    )?.label ?? "Select A Model"}
                                  </>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {runtimeModelOptions(effectiveDraft.runtime).map((model) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    {effectiveDraft.runtime ? (
                                      <RuntimeProviderIcon runtimeId={effectiveDraft.runtime} />
                                    ) : null}
                                    {model.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field className={fieldSpacing}>
                          <FieldHeading
                            htmlFor="reasoning-effort"
                            label="Reasoning Effort"
                            description={
                              selectedEfforts.length === 0
                                ? "This model does not accept a reasoning effort."
                                : "Higher effort spends more subscription usage per run."
                            }
                          />
                          {selectedEfforts.length === 0 ? (
                            <div
                              id="reasoning-effort"
                              className="flex h-8 items-center rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground"
                            >
                              Not Applicable
                            </div>
                          ) : (
                            <Select
                              items={selectedEfforts.map((effort) => ({
                                label: reasoningEffortLabel(effort),
                                value: effort,
                              }))}
                              value={effectiveDraft.reasoningEffort}
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
                        </Field>
                      </div>
                    ) : null}
                  </>
                )}
              </FieldGroup>
            </form>
          </section>

          <div ref={preflightSectionRef} className="scroll-mt-2">
            <RunPreflightSection
              preflight={preflight}
              selectedAreaId={selectedAreaId}
              onSelectedAreaChange={setSelectedAreaId}
              error={error}
              createdRun={createdRun}
            />
          </div>
        </div>
      </ScrollArea>

      {!createdRun ? (
        <SheetFooter className="border-t p-3">
          {!preflight ? (
            <Button type="submit" form="new-run-brief" disabled={busy || !effectiveDraft.runtime}>
              <Icon
                icon={busy ? Loading03Icon : Search01Icon}
                className={busy ? "animate-spin" : undefined}
              />
              {busy ? "Checking Preflight" : "Check Preflight"}
            </Button>
          ) : (
            <Button onClick={createRun} disabled={busy || !preflight.ready || !selectedAreaId}>
              <Icon
                icon={busy ? Loading03Icon : Search01Icon}
                className={busy ? "animate-spin" : undefined}
              />
              {busy ? "Creating Run" : "Confirm And Create Run"}
            </Button>
          )}
        </SheetFooter>
      ) : null}
    </>
  )
}
