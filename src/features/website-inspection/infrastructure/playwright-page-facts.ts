import type { Page } from "playwright"

import type {
  InspectionForm,
  InspectionLink,
} from "@/features/website-inspection/application/website-inspector"

const MAX_RENDERED_TEXT_CHARACTERS = 50_000
const MAX_LINKS = 100
const MAX_FORMS = 20

export async function extractPageFacts(page: Page) {
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
