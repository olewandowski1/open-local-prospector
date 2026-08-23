"use client"

import { AlertCircleIcon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/icon"

import { PageHeader, SectionHeader } from "@/components/page-layout"
import { PageScroller } from "@/components/page-scroller"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import type { SearchBriefPreflight } from "@/features/prospecting-runs/application/search-brief-preflight"
import { RunPreflightPanel } from "@/features/prospecting-runs/presentation/run-preflight-panel"
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

export function SearchBriefPage({
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
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
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

  const serializedDraft = () => serializeSearchBriefDraft(draft)

  const checkPreflight = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setCreatedRun(undefined)
    try {
      const response = await fetch("/api/prospecting-runs/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializedDraft()),
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
          draft: serializedDraft(),
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
    <PageScroller>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <div className="min-w-0">
          <PageHeader
            eyebrow="New prospecting run"
            title="Create a Search Brief"
            description="Define the market, confirm how the location was interpreted, and verify local readiness."
          />

          {readyRuntimes.length === 0 ? (
            <Alert variant="destructive" className="mt-6">
              <Icon icon={AlertCircleIcon} />
              <AlertTitle>No subscription runtime is ready</AlertTitle>
              <AlertDescription>
                <Link href="/settings/subscription">Open Settings</Link> and follow the terminal
                instructions before creating a run.
              </AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="search-scope-heading" className="mt-6 border-y py-5">
            <SectionHeader
              title={<span id="search-scope-heading">Search Scope</span>}
              description="Poland is assumed when no country is provided. Add a country to search elsewhere."
              className="mb-5"
            />
            <form onSubmit={checkPreflight}>
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
                    Search runs only when you choose Check preflight; there is no location
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
                        {categoryPresets.map((category) => (
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

                <Button type="submit" disabled={!hydrated || busy || !draft.runtime}>
                  {busy ? (
                    <Icon icon={Loading03Icon} className="animate-spin" />
                  ) : (
                    <Icon icon={Search01Icon} />
                  )}
                  Check preflight
                </Button>
              </FieldGroup>
            </form>
          </section>
        </div>

        <RunPreflightPanel
          preflight={preflight}
          selectedAreaId={selectedAreaId}
          onSelectedAreaChange={setSelectedAreaId}
          error={error}
          busy={busy}
          createdRun={createdRun}
          onCreateRun={createRun}
        />
      </div>
    </PageScroller>
  )
}
