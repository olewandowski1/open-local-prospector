import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { type Browser, type BrowserContext, chromium, type Page } from "playwright"

import type {
  InspectionBlock,
  InspectionPageEvidence,
  InspectionViewport,
  WebsiteInspectionResult,
  WebsiteInspector,
} from "@/features/website-inspection/application/website-inspector"
import { WebsiteInspectorError } from "@/features/website-inspection/application/website-inspector"
import {
  type ResolveHost,
  resolveHostAddresses,
  validatePublicHttpUrl,
} from "@/features/website-inspection/domain/network-policy"
import {
  detectInterstitial,
  selectRelevantPage,
} from "@/features/website-inspection/infrastructure/inspection-page-policy"
import {
  type PinnedHttpProxy,
  startPinnedHttpProxy,
} from "@/features/website-inspection/infrastructure/pinned-http-proxy"
import {
  applyInspectionPolicy,
  type FixtureResponses,
  networkBlock,
  safeLogUrl,
} from "@/features/website-inspection/infrastructure/playwright-inspection-policy"
import { extractPageFacts } from "@/features/website-inspection/infrastructure/playwright-page-facts"

const MAX_FAILURES = 50
const NAVIGATION_TIMEOUT_MILLISECONDS = 15_000

export type PlaywrightInspectorOptions = Readonly<{
  resolveHost?: ResolveHost
  fixtureResponses?: FixtureResponses
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
                message: `The isolated browser inspection failed: ${failureDetail(error)}`,
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
    // Treat browser launch contention as transient and preserve Playwright's diagnostic.
    const installed = existsSync(chromium.executablePath())
    throw new WebsiteInspectorError({
      classification: installed ? "Transient" : "Infrastructure",
      code: installed ? "chromium-launch-failed" : "chromium-unavailable",
      message: installed
        ? `Chromium did not start: ${failureDetail(error)}`
        : 'The dedicated Playwright Chromium executable is unavailable. Run "pnpm run setup".',
    })
  }

  let proxy: PinnedHttpProxy
  try {
    proxy = await startPinnedHttpProxy(resolveHost)
  } catch (error) {
    await browser.close()
    throw error
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
      proxy,
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
      proxy,
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
    await proxy.close()
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
  proxy: PinnedHttpProxy,
): Promise<ViewportSession> {
  const context = await browser.newContext({
    viewport: viewport === "Desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    screen: viewport === "Desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    acceptDownloads: false,
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [] },
    proxy: proxy.playwrightProxy,
  })
  const page = await context.newPage()
  const { consoleFailures, networkFailures } = await applyInspectionPolicy({
    context,
    page,
    initialUrl,
    resolveHost,
    fixtureResponses,
    blocks,
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
      message: `The page could not be rendered within the bounded inspection policy: ${failureDetail(error)}`,
      recordedAt: new Date(),
    })
    return undefined
  }
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

// Bounded to one line so a stack trace cannot fill the Technical Run Log.
function failureDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.split(/\r?\n/u)[0]?.trim().slice(0, 200) || "no detail reported"
}
