import { Context, Data, Effect } from "effect"

import type { DependencyReadiness } from "@/features/local-application"
import {
  decodeSearchBriefDraft,
  type SearchArea,
  type SearchBriefDraft,
} from "@/features/prospecting-runs/domain/search-brief"
import { isRuntimeExecutionConfiguration, type RuntimeReadiness } from "@/features/runtime-settings"

export class GeocodingError extends Data.TaggedError("GeocodingError")<{
  readonly reason: "unreachable" | "unsupported-response"
}> {}

export interface SearchAreaGeocoderService {
  readonly search: (location: string) => Effect.Effect<readonly SearchArea[], GeocodingError>
}

export class SearchAreaGeocoder extends Context.Tag("ProspectingRuns/SearchAreaGeocoder")<
  SearchAreaGeocoder,
  SearchAreaGeocoderService
>() {}

export type WorkloadEstimate = Readonly<{
  discoveryQueries: number
  likelyInspections: number
  duration: string
  note: string
}>

export type SearchBriefPreflight = Readonly<{
  draft: SearchBriefDraft
  searchAreas: readonly SearchArea[]
  dependencies: readonly DependencyReadiness[]
  runtime: RuntimeReadiness
  estimate: WorkloadEstimate
  ready: boolean
}>

export const prepareSearchBrief = (
  input: unknown,
  dependencies: readonly DependencyReadiness[],
  runtime: RuntimeReadiness,
) =>
  Effect.gen(function* () {
    const draft = yield* decodeSearchBriefDraft(input)
    const geocoder = yield* SearchAreaGeocoder
    const searchAreas = yield* geocoder.search(defaultPoland(draft.location))
    const ready =
      searchAreas.length > 0 &&
      dependencies.every((dependency) => dependency.status === "Ready") &&
      runtime.runtimeId === draft.runtime &&
      runtime.status === "Ready" &&
      isRuntimeExecutionConfiguration(draft.runtime, draft.runtimeConfiguration)

    return {
      draft,
      searchAreas,
      dependencies,
      runtime,
      estimate: estimateWorkload(draft),
      ready,
    } satisfies SearchBriefPreflight
  })

export function defaultPoland(location: string): string {
  return location.includes(",") ? location : `${location}, Poland`
}

/**
 * Quick asks two angles of the runtime and Thorough four, matching `planDiscoveryQueries`. A count
 * that disagrees with the plan is worse than no count: it is a promise the run will not keep.
 */
export function estimateWorkload(draft: SearchBriefDraft): WorkloadEstimate {
  const thorough = draft.mode === "Thorough"
  const discoveryQueries = thorough ? 4 : 2
  const likelyInspections = Math.ceil(draft.targetCount * (thorough ? 2.5 : 1.5))
  const base = Math.max(3, Math.ceil(likelyInspections * (thorough ? 0.8 : 0.35)))
  const lowerMinutes = Math.ceil(base * runtimePace(draft.runtime))
  const upperMinutes = Math.ceil(lowerMinutes * 1.8)
  return {
    discoveryQueries,
    likelyInspections,
    duration: `${lowerMinutes}–${upperMinutes} minutes`,
    note: "An operational estimate, not a provider subscription cost quote.",
  }
}

/**
 * Relative pace measured with the same Quick brief. Claude completed in 6.8–9.3 minutes, OpenCode
 * in 5.6–7.6 minutes, and Codex did not finish discovery within its 15-minute attempt. Quoting one
 * number for every runtime would promise a reader something the run cannot keep.
 */
function runtimePace(runtime: SearchBriefDraft["runtime"]): number {
  if (runtime === "codex") return 4
  return 2
}
