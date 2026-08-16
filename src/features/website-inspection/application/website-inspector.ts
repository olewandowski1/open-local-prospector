import { Data, type Effect } from "effect"

export type InspectionViewport = "Desktop" | "Mobile"

export type InspectionLink = Readonly<{ text: string; url: string }>
export type InspectionForm = Readonly<{
  action: string
  method: string
  inputTypes: readonly string[]
}>
export type PageMeasurements = Readonly<{
  navigationDurationMs?: number
  domContentLoadedMs?: number
  firstContentfulPaintMs?: number
  domNodes: number
  headings: number
  links: number
  forms: number
  images: number
  imagesMissingAlt: number
  unlabeledControls: number
  horizontalOverflow: boolean
  usesHttps: boolean
}>

export type InspectionPageEvidence = Readonly<{
  sequence: number
  viewport: InspectionViewport
  requestedUrl: string
  finalUrl: string
  title: string
  description?: string
  language?: string
  renderedText: string
  links: readonly InspectionLink[]
  forms: readonly InspectionForm[]
  consoleFailures: readonly string[]
  networkFailures: readonly string[]
  measurements: PageMeasurements
  capturedAt: Date
  screenshotPath: string
  screenshotBytes: number
  screenshotSha256: string
}>

export type InspectionBlock = Readonly<{
  code: string
  url?: string
  message: string
  recordedAt: Date
}>

export type WebsiteInspectionResult = Readonly<{
  status: "Complete" | "Partial" | "Blocked" | "NoWebsite"
  pages: readonly InspectionPageEvidence[]
  blocks: readonly InspectionBlock[]
  startedAt: Date
  completedAt: Date
  configurationVersion: "quick-v1"
}>

export class WebsiteInspectorError extends Data.TaggedError("WebsiteInspectorError")<{
  readonly classification: "Transient" | "Infrastructure"
  readonly code: string
  readonly message: string
}> {}

export interface WebsiteInspector {
  readonly inspect: (input: {
    url: string
    artifactDirectory: string
  }) => Effect.Effect<WebsiteInspectionResult, WebsiteInspectorError>
}
