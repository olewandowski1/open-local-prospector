"use client"

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, MapPin, Play, Search } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import type { SearchBriefPreflight } from "@/features/prospecting-runs/application/search-brief-preflight"
import type { RuntimeId, RuntimeReadiness } from "@/features/runtime-settings"

const categoryPresets = [
  "Dental clinics",
  "Restaurants",
  "Beauty salons",
  "Construction companies",
  "Law firms",
  "Custom category",
] as const

type DraftState = Readonly<{
  location: string
  radiusKm: string
  categoryChoice: string
  customCategory: string
  targetCount: string
  mode: "Quick" | "Thorough"
  runtime: RuntimeId | ""
}>

export function SearchBriefPage({
  defaults,
  readyRuntimes,
  selectedRuntime,
}: {
  defaults?: SearchBriefDefaults
  readyRuntimes: readonly RuntimeReadiness[]
  selectedRuntime?: RuntimeId
}) {
  const defaultCategory = defaults?.category ?? "Dental clinics"
  const categoryIsPreset = categoryPresets.some(
    (category) => category !== "Custom category" && category === defaultCategory,
  )
  const preferredRuntime = readyRuntimes.some((runtime) => runtime.runtimeId === selectedRuntime)
    ? selectedRuntime
    : readyRuntimes[0]?.runtimeId
  const [draft, setDraft] = useState<DraftState>({
    location: "",
    radiusKm: defaults?.radiusKm?.toString() ?? "",
    categoryChoice: categoryIsPreset ? defaultCategory : "Custom category",
    customCategory: categoryIsPreset ? "" : defaultCategory,
    targetCount: String(defaults?.targetCount ?? 10),
    mode: defaults?.mode ?? "Quick",
    runtime: preferredRuntime ?? "",
  })
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

  const invalidate = (next: Partial<DraftState>) => {
    setDraft((current) => ({ ...current, ...next }))
    setPreflight(undefined)
    setSelectedAreaId("")
    setRequestId("")
    setCreatedRun(undefined)
    setError("")
  }

  const serializedDraft = () => ({
    location: draft.location,
    ...(draft.radiusKm === "" ? {} : { radiusKm: Number(draft.radiusKm) }),
    category:
      draft.categoryChoice === "Custom category" ? draft.customCategory : draft.categoryChoice,
    targetCount: Number(draft.targetCount),
    mode: draft.mode,
    runtime: draft.runtime,
  })

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
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <div>
          <Badge variant="secondary" className="mb-3">
            New prospecting run
          </Badge>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Create a Search Brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the market, confirm how the location was interpreted, and verify local readiness.
          </p>

          {readyRuntimes.length === 0 ? (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>No subscription runtime is ready</AlertTitle>
              <AlertDescription>
                <Link href="/settings">Open Settings</Link> and follow the terminal instructions
                before creating a run.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Search scope</CardTitle>
              <CardDescription>
                Poland is assumed when no country is provided. Add a country to search elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={checkPreflight}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="location">City or municipality</FieldLabel>
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
                      <FieldLabel htmlFor="radius">Radius in kilometres (optional)</FieldLabel>
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
                      <FieldLabel htmlFor="target">Target businesses</FieldLabel>
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
                    <FieldLabel htmlFor="category">Business category</FieldLabel>
                    <Select
                      items={categoryItems}
                      value={draft.categoryChoice}
                      onValueChange={(value) => value && invalidate({ categoryChoice: value })}
                    >
                      <SelectTrigger
                        id="category"
                        aria-label="Business category"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryPresets.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.categoryChoice === "Custom category" ? (
                    <Field>
                      <FieldLabel htmlFor="custom-category">Custom category</FieldLabel>
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
                    <FieldLegend>Run mode</FieldLegend>
                    <RadioGroup
                      value={draft.mode}
                      onValueChange={(value) =>
                        value && invalidate({ mode: value as DraftState["mode"] })
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
                    <FieldLabel htmlFor="runtime">Subscription runtime</FieldLabel>
                    <Select
                      items={runtimeItems}
                      value={draft.runtime}
                      onValueChange={(value) =>
                        value && invalidate({ runtime: value as RuntimeId })
                      }
                    >
                      <SelectTrigger
                        id="runtime"
                        aria-label="Subscription runtime"
                        className="w-full"
                        disabled={!runtimeItems.length}
                      >
                        <SelectValue placeholder="No ready runtime" />
                      </SelectTrigger>
                      <SelectContent>
                        {readyRuntimes.map((runtime) => (
                          <SelectItem key={runtime.runtimeId} value={runtime.runtimeId}>
                            {runtime.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Button type="submit" disabled={!hydrated || busy || !draft.runtime}>
                    {busy ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Search aria-hidden="true" />
                    )}
                    Check preflight
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside aria-label="Run preflight" className="lg:pt-20">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Run preflight</CardTitle>
              <CardDescription>
                Nothing is persisted as a run until you confirm here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Unable to continue</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {!preflight ? (
                <p className="text-sm text-muted-foreground">
                  Complete the Search Brief and check preflight to interpret the area and verify
                  dependencies.
                </p>
              ) : (
                <>
                  <section aria-labelledby="search-area-title">
                    <h2 id="search-area-title" className="text-sm font-semibold">
                      Interpreted Search Area
                    </h2>
                    {preflight.searchAreas.length === 0 ? (
                      <p className="mt-2 text-sm text-destructive">
                        No matching location was found.
                      </p>
                    ) : (
                      <RadioGroup
                        value={selectedAreaId}
                        onValueChange={(value) => value && setSelectedAreaId(value)}
                        className="mt-3"
                        aria-label="Search Area"
                      >
                        {preflight.searchAreas.map((area) => (
                          <FieldLabel key={area.id}>
                            <Field orientation="horizontal">
                              <RadioGroupItem value={area.id} aria-label={area.displayName} />
                              <MapPin aria-hidden="true" />
                              <span className="text-sm">{area.displayName}</span>
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                    )}
                    {preflight.searchAreas.length > 1 && !selectedAreaId ? (
                      <p className="mt-2 text-xs font-medium text-destructive">
                        Select the intended Search Area explicitly.
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Geocoding © OpenStreetMap contributors. Public Nominatim is used only on your
                      explicit request, cached locally, and limited to one request per second. Read
                      the{" "}
                      <a
                        className="underline underline-offset-4"
                        href="https://operations.osmfoundation.org/policies/nominatim/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        usage policy
                      </a>
                      .
                    </p>
                  </section>

                  <section aria-labelledby="dependency-title">
                    <h2 id="dependency-title" className="text-sm font-semibold">
                      Dependencies
                    </h2>
                    <ul className="mt-2 grid gap-2">
                      {[...preflight.dependencies, preflight.runtime].map((dependency) => (
                        <li
                          key={"id" in dependency ? dependency.id : dependency.runtimeId}
                          className="flex items-start gap-2 text-sm"
                        >
                          {dependency.status === "Ready" ? (
                            <CheckCircle2 className="mt-0.5 text-emerald-600" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="mt-0.5 text-destructive" aria-hidden="true" />
                          )}
                          <span className="flex-1">{dependency.label}</span>
                          <Badge
                            variant={dependency.status === "Ready" ? "secondary" : "destructive"}
                          >
                            {dependency.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="estimate-title" className="rounded-lg bg-muted p-3">
                    <h2
                      id="estimate-title"
                      className="flex items-center gap-2 text-sm font-semibold"
                    >
                      <Clock3 aria-hidden="true" /> Workload estimate
                    </h2>
                    <p className="mt-2 text-sm">
                      About {preflight.estimate.discoveryQueries} discovery queries, up to{" "}
                      {preflight.estimate.likelyInspections} inspections, and{" "}
                      {preflight.estimate.duration}.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{preflight.estimate.note}</p>
                  </section>

                  {createdRun ? (
                    <Alert>
                      <CheckCircle2 aria-hidden="true" />
                      <AlertTitle>Pending run created</AlertTitle>
                      <AlertDescription>
                        Run {createdRun.id} is ready for the worker.{" "}
                        <Link href={`/runs/${createdRun.id}`}>View progress</Link>.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Button
                      onClick={createRun}
                      disabled={busy || !preflight.ready || !selectedAreaId}
                    >
                      {busy ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Play aria-hidden="true" />
                      )}
                      Confirm and create run
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
