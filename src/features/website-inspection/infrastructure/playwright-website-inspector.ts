import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { type Browser, type BrowserContext, chromium, type Page } from "playwright"

import type {
  InspectionBlock,
  InspectionForm,
  InspectionLink,
  InspectionPageEvidence,
  InspectionViewport,
  WebsiteInspectionResult,
  WebsiteInspector,
} from "@/features/website-inspection/application/website-inspector"
import { WebsiteInspectorError } from "@/features/website-inspection/application/website-inspector"
import {
  assertApprovedNavigation,
  type ResolveHost,
  resolveHostAddresses,
  validatePublicHttpUrl,
} from "@/features/website-inspection/domain/network-policy"

const MAX_RENDERED_TEXT_CHARACTERS = 50_000
const MAX_LINKS = 100
const MAX_FORMS = 20
const MAX_FAILURES = 50
const NAVIGATION_TIMEOUT_MILLISECONDS = 15_000

export type PlaywrightInspectorOptions = Readonly<{
  resolveHost?: ResolveHost
  fixtureResponses?: Readonly<
    Record<string, { body: string; status?: number; contentType?: string }>
  >
}>

export function makePlaywrightWebsiteInspector(
  options: PlaywrightInspectorOptions = {},
): WebsiteInspector {
  return {
    inspect: (input) =>
      Effect.tryPromise({
        try: () => inspectWithPlaywright(input, options),
        catch: (error) =>
          error instanceof WebsiteInspectorError
            ? error
            : new WebsiteInspectorError({
                classification: "Infrastructure",
                code: "browser-inspection-failed",
                // Say what actually went wrong; a reader cannot act on "could not be completed".
                message: `The isolated browser inspection failed: ${launchFailureDetail(error)}`,
              }),
      }),
  }
}

async function inspectWithPlaywright(
  input: { url: string; artifactDirectory: string },
  options: PlaywrightInspectorOptions,
): Promise<WebsiteInspectionResult> {
  const startedAt = new Date()
  const resolveHost = options.resolveHost ?? resolveHostAddresses
  try {
    await validatePublicHttpUrl(input.url, resolveHost)
  } catch (error) {
    return blockedResult(startedAt, networkBlock(error, input.url))
  }
  await mkdir(input.artifactDirectory, { recursive: true })
  let browser: Browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    // A browser that is installed but would not start is a transient condition — it is usually
    // contention with the inspections running beside it — so the business is retried rather than
    // dropped from the run. Playwright's own words are kept: this is our tool, not source content.
    const installed = existsSync(chromium.executablePath())
    throw new WebsiteInspectorError({
      classification: installed ? "Transient" : "Infrastructure",
      code: installed ? "chromium-launch-failed" : "chromium-unavailable",
      message: installed
        ? `Chromium did not start: ${launchFailureDetail(error)}`
        : 'The dedicated Playwright Chromium executable is unavailable. Run "pnpm run setup".',
    })
  }

  const blocks: InspectionBlock[] = []
  const pages: InspectionPageEvidence[] = []
  try {
    const desktop = await inspectViewport(
      browser,
      input.url,
      "Desktop",
      input.artifactDirectory,
      resolveHost,
      options.fixtureResponses,
      blocks,
    )
    pages.push(...desktop.pages)
    if (desktop.blocked || desktop.pages.length === 0) {
      return finishResult(startedAt, pages, blocks, "Blocked")
    }
    const relevantUrl = selectRelevantPage(desktop.pages[0]?.links ?? [], input.url)
    if (!relevantUrl) {
      blocks.push({
        code: "relevant-page-not-found",
        message: "No same-site enquiry, booking, service, or purchasing page was found.",
        recordedAt: new Date(),
      })
      return finishResult(startedAt, pages, blocks, "Partial")
    }
    const desktopRelevant = await inspectAdditionalPage(
      desktop,
      relevantUrl,
      pages.length,
      input.artifactDirectory,
      blocks,
    )
    if (desktopRelevant) pages.push(desktopRelevant)

    const mobile = await inspectViewport(
      browser,
      input.url,
      "Mobile",
      input.artifactDirectory,
      resolveHost,
      options.fixtureResponses,
      blocks,
    )
    pages.push(...mobile.pages)
    if (!mobile.blocked) {
      const mobileRelevant = await inspectAdditionalPage(
        mobile,
        relevantUrl,
        pages.length,
        input.artifactDirectory,
        blocks,
      )
      if (mobileRelevant) pages.push(mobileRelevant)
    }
    return finishResult(
      startedAt,
      pages,
      blocks,
      pages.length === 4 && blocks.length === 0 ? "Complete" : "Partial",
    )
  } finally {
    await browser.close()
  }
}

type ViewportSession = Readonly<{
  context: BrowserContext
  page: Page
  viewport: InspectionViewport
  pages: readonly InspectionPageEvidence[]
  blocked: boolean
  consoleFailures: string[]
  networkFailures: string[]
}>

async function inspectViewport(
  browser: Browser,
  initialUrl: string,
  viewport: InspectionViewport,
  artifactDirectory: string,
  resolveHost: ResolveHost,
  fixtureResponses: PlaywrightInspectorOptions["fixtureResponses"],
  blocks: InspectionBlock[],
): Promise<ViewportSession> {
  const context = await browser.newContext({
    viewport: viewport === "Desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    screen: viewport === "Desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    acceptDownloads: false,
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [] },
  })
  await context.routeWebSocket(/.*/u, async (socket) => {
    blocks.push({
      code: "websocket-blocked",
      message: "A non-HTTP(S) WebSocket connection was blocked.",
      recordedAt: new Date(),
    })
    await socket.close({ code: 1008, reason: "Website inspection allows HTTP(S) resources only." })
  })
  const page = await context.newPage()
  const consoleFailures: string[] = []
  const networkFailures: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" && consoleFailures.length < MAX_FAILURES) {
      consoleFailures.push(message.text().slice(0, 1_000))
    }
  })
  page.on("pageerror", (error) => {
    if (consoleFailures.length < MAX_FAILURES) consoleFailures.push(error.message.slice(0, 1_000))
  })
  page.on("requestfailed", (request) => {
    if (networkFailures.length < MAX_FAILURES) {
      networkFailures.push(
        `${request.method()} ${safeLogUrl(request.url())} ${request.failure()?.errorText ?? "failed"}`,
      )
    }
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
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        assertApprovedNavigation(initialUrl, request.url())
      }
      const fixture = fixtureResponses?.[request.url()]
      if (fixture) {
        await route.fulfill({
          status: fixture.status ?? 200,
          contentType: fixture.contentType ?? "text/html",
          body: fixture.body,
        })
      } else {
        await route.continue()
      }
    } catch (error) {
      blocks.push(networkBlock(error, request.url()))
      await route.abort("blockedbyclient")
    }
  })

  const evidence = await capturePage(
    page,
    initialUrl,
    viewport,
    0,
    artifactDirectory,
    consoleFailures,
    networkFailures,
    blocks,
  )
  return {
    context,
    page,
    viewport,
    pages: evidence ? [evidence] : [],
    blocked: !evidence,
    consoleFailures,
    networkFailures,
  }
}

async function inspectAdditionalPage(
  session: ViewportSession,
  url: string,
  sequence: number,
  artifactDirectory: string,
  blocks: InspectionBlock[],
): Promise<InspectionPageEvidence | undefined> {
  try {
    return await capturePage(
      session.page,
      url,
      session.viewport,
      sequence,
      artifactDirectory,
      session.consoleFailures,
      session.networkFailures,
      blocks,
    )
  } finally {
    await session.context.close()
  }
}

async function capturePage(
  page: Page,
  requestedUrl: string,
  viewport: InspectionViewport,
  sequence: number,
  artifactDirectory: string,
  consoleFailures: string[],
  networkFailures: string[],
  blocks: InspectionBlock[],
): Promise<InspectionPageEvidence | undefined> {
  const consoleStart = consoleFailures.length
  const networkStart = networkFailures.length
  try {
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
    })
    if (!response) {
      blocks.push({
        code: "navigation-failed",
        url: requestedUrl,
        message: "The page returned no navigation response.",
        recordedAt: new Date(),
      })
      return undefined
    }
    if ([401, 403, 429].includes(response.status())) {
      blocks.push({
        code: response.status() === 429 ? "rate-limited" : "authentication-or-access-block",
        url: safeLogUrl(response.url()),
        message:
          "The page presented an authentication, access, or rate-limit barrier; no bypass was attempted.",
        recordedAt: new Date(),
      })
      return undefined
    }
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined)
    const facts = await extractPageFacts(page)
    const interstitial = detectInterstitial(`${facts.title}\n${facts.renderedText}`)
    if (interstitial) {
      blocks.push({
        code: interstitial,
        url: safeLogUrl(page.url()),
        message:
          "A CAPTCHA, authentication, automation, or platform interstitial was recorded without bypass.",
        recordedAt: new Date(),
      })
      return undefined
    }
    const screenshotPath = join(
      artifactDirectory,
      `${String(sequence + 1).padStart(2, "0")}-${viewport.toLocaleLowerCase("en")}.png`,
    )
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      animations: "disabled",
      timeout: 10_000,
    })
    const screenshot = await readFile(screenshotPath)
    return {
      sequence,
      viewport,
      requestedUrl,
      finalUrl: safeLogUrl(page.url()),
      title: facts.title,
      ...(facts.description ? { description: facts.description } : {}),
      ...(facts.language ? { language: facts.language } : {}),
      renderedText: facts.renderedText,
      links: facts.links,
      forms: facts.forms,
      consoleFailures: consoleFailures.slice(consoleStart, consoleStart + MAX_FAILURES),
      networkFailures: networkFailures.slice(networkStart, networkStart + MAX_FAILURES),
      measurements: facts.measurements,
      capturedAt: new Date(),
      screenshotPath,
      screenshotBytes: screenshot.byteLength,
      screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    }
  } catch (error) {
    blocks.push({
      code:
        error instanceof Error && error.message.includes("ERR_BLOCKED_BY_CLIENT")
          ? "network-policy-block"
          : "navigation-failed",
      url: safeLogUrl(requestedUrl),
      message: "The page could not be rendered within the bounded inspection policy.",
      recordedAt: new Date(),
    })
    return undefined
  }
}

async function extractPageFacts(page: Page) {
  return page.evaluate(
    ({ maxText, maxLinks, maxForms }) => {
      const clean = (value: string | null | undefined, limit: number) =>
        (value ?? "").replace(/\s+/gu, " ").trim().slice(0, limit)
      const links: InspectionLink[] = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]"),
      )
        .slice(0, maxLinks)
        .flatMap((link) => {
          try {
            const url = new URL(link.href)
            return url.protocol === "http:" || url.protocol === "https:"
              ? [
                  {
                    text: clean(link.innerText || link.getAttribute("aria-label"), 300),
                    url: url.toString(),
                  },
                ]
              : []
          } catch {
            return []
          }
        })
      const forms: InspectionForm[] = Array.from(document.forms)
        .slice(0, maxForms)
        .map((form) => ({
          action: form.action,
          method: form.method.toUpperCase(),
          inputTypes: Array.from(form.elements)
            .flatMap((element) =>
              element instanceof HTMLInputElement ||
              element instanceof HTMLButtonElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement
                ? [
                    element instanceof HTMLInputElement
                      ? element.type
                      : element.tagName.toLocaleLowerCase("en"),
                  ]
                : [],
            )
            .slice(0, 50),
        }))
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined
      const paint = performance.getEntriesByName("first-contentful-paint")[0]
      const controls = Array.from(
        document.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
        >("input, select, textarea, button"),
      )
      const unlabeledControls = controls.filter((control) => {
        const labels = control.labels
        return !(
          labels?.length ||
          control.getAttribute("aria-label") ||
          control.getAttribute("aria-labelledby") ||
          (control instanceof HTMLInputElement &&
            ["hidden", "submit", "button", "image"].includes(control.type))
        )
      }).length
      const images = Array.from(document.images)
      return {
        title: clean(document.title, 500),
        description: clean(
          document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
          2_000,
        ),
        language: clean(document.documentElement.lang, 50),
        renderedText: clean(document.body?.innerText, maxText),
        links,
        forms,
        measurements: {
          ...(navigation
            ? {
                navigationDurationMs: Math.round(navigation.duration),
                domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
              }
            : {}),
          ...(paint ? { firstContentfulPaintMs: Math.round(paint.startTime) } : {}),
          domNodes: document.querySelectorAll("*").length,
          headings: document.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
          links: document.links.length,
          forms: document.forms.length,
          images: images.length,
          imagesMissingAlt: images.filter((image) => !image.hasAttribute("alt")).length,
          unlabeledControls,
          horizontalOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          usesHttps: location.protocol === "https:",
        },
      }
    },
    { maxText: MAX_RENDERED_TEXT_CHARACTERS, maxLinks: MAX_LINKS, maxForms: MAX_FORMS },
  )
}

function selectRelevantPage(
  links: readonly InspectionLink[],
  initialUrl: string,
): string | undefined {
  const keywords = [
    "kontakt",
    "contact",
    "rezerw",
    "booking",
    "umów",
    "oferta",
    "services",
    "usługi",
    "sklep",
    "shop",
    "zamów",
  ]
  return links
    .filter((link) => {
      try {
        assertApprovedNavigation(initialUrl, link.url)
        return true
      } catch {
        return false
      }
    })
    .map((link) => ({
      url: link.url,
      score: keywords.reduce(
        (score, keyword, index) =>
          `${link.text} ${link.url}`.toLocaleLowerCase("pl").includes(keyword)
            ? score + keywords.length - index
            : score,
        0,
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.url
}

function detectInterstitial(text: string): string | undefined {
  const normalized = text.toLocaleLowerCase("en")
  if (/captcha|verify you are human|potwierdź, że jesteś człowiekiem/u.test(normalized))
    return "captcha"
  if (/just a moment|checking your browser|access denied|automation detected/u.test(normalized))
    return "automation-block"
  if (/sign in to continue|zaloguj się, aby kontynuować/u.test(normalized))
    return "authentication-required"
  return undefined
}

function finishResult(
  startedAt: Date,
  pages: readonly InspectionPageEvidence[],
  blocks: readonly InspectionBlock[],
  status: WebsiteInspectionResult["status"],
): WebsiteInspectionResult {
  return {
    status,
    pages,
    blocks,
    startedAt,
    completedAt: new Date(),
    configurationVersion: "quick-v1",
  }
}

function blockedResult(startedAt: Date, block: InspectionBlock): WebsiteInspectionResult {
  return finishResult(startedAt, [], [block], "Blocked")
}

function networkBlock(error: unknown, url: string): InspectionBlock {
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

function safeLogUrl(value: string): string {
  try {
    const url = new URL(value)
    url.username = ""
    url.password = ""
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|auth|session|password|secret|code/iu.test(key)) {
        url.searchParams.set(key, "[redacted]")
      }
    }
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "blocked:unsafe-url"
  } catch {
    return "blocked:invalid-url"
  }
}

// Bounded to one line so a stack trace cannot fill the Technical Run Log.
function launchFailureDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.split(/\r?\n/u)[0]?.trim().slice(0, 200) || "no detail reported"
}
