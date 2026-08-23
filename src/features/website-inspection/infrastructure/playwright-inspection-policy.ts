import type { BrowserContext, Page } from "playwright"

import type { InspectionBlock } from "@/features/website-inspection/application/website-inspector"
import {
  assertApprovedNavigation,
  type ResolveHost,
  validatePublicHttpUrl,
} from "@/features/website-inspection/domain/network-policy"

const MAX_FAILURES = 50

export type FixtureResponses = Readonly<
  Record<string, { body: string; status?: number; contentType?: string }>
>

export async function applyInspectionPolicy({
  context,
  page,
  initialUrl,
  resolveHost,
  fixtureResponses,
  blocks,
}: {
  context: BrowserContext
  page: Page
  initialUrl: string
  resolveHost: ResolveHost
  fixtureResponses?: FixtureResponses
  blocks: InspectionBlock[]
}): Promise<{ consoleFailures: string[]; networkFailures: string[] }> {
  const consoleFailures: string[] = []
  const networkFailures: string[] = []
  await context.routeWebSocket(/.*/u, async (socket) => {
    blocks.push({
      code: "websocket-blocked",
      message: "A non-HTTP(S) WebSocket connection was blocked.",
      recordedAt: new Date(),
    })
    await socket.close({ code: 1008, reason: "Website inspection allows HTTP(S) resources only." })
  })
  page.on("console", (message) => {
    if (message.type() === "error" && consoleFailures.length < MAX_FAILURES)
      consoleFailures.push(message.text().slice(0, 1_000))
  })
  page.on("pageerror", (error) => {
    if (consoleFailures.length < MAX_FAILURES) consoleFailures.push(error.message.slice(0, 1_000))
  })
  page.on("requestfailed", (request) => {
    if (networkFailures.length < MAX_FAILURES)
      networkFailures.push(
        `${request.method()} ${safeLogUrl(request.url())} ${request.failure()?.errorText ?? "failed"}`,
      )
  })
  context.on("download", (download) => {
    blocks.push({
      code: "download-blocked",
      url: safeLogUrl(download.url()),
      message: "A website download was blocked.",
      recordedAt: new Date(),
    })
    void download.cancel()
  })
  context.on("page", (candidate) => {
    if (candidate !== page) {
      blocks.push({
        code: "popup-blocked",
        message: "A website popup was blocked.",
        recordedAt: new Date(),
      })
      void candidate.close()
    }
  })
  await context.route("**/*", async (route) => {
    const request = route.request()
    try {
      await validatePublicHttpUrl(request.url(), resolveHost)
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        assertApprovedNavigation(initialUrl, request.url())
      const fixture = fixtureResponses?.[request.url()]
      if (fixture)
        await route.fulfill({
          status: fixture.status ?? 200,
          contentType: fixture.contentType ?? "text/html",
          body: fixture.body,
        })
      else await route.continue()
    } catch (error) {
      blocks.push(networkBlock(error, request.url()))
      await route.abort("blockedbyclient")
    }
  })
  return { consoleFailures, networkFailures }
}

export function safeLogUrl(value: string): string {
  try {
    const url = new URL(value)
    url.username = ""
    url.password = ""
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|auth|session|password|secret|code/iu.test(key))
        url.searchParams.set(key, "[redacted]")
    }
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "blocked:unsafe-url"
  } catch {
    return "blocked:invalid-url"
  }
}

export function networkBlock(error: unknown, url: string): InspectionBlock {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "network-policy-block"
  return {
    code,
    url: safeLogUrl(url),
    message: "A destination was blocked by the public-network inspection policy.",
    recordedAt: new Date(),
  }
}
