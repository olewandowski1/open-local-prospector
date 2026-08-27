import type { InspectionLink } from "@/features/website-inspection/application/website-inspector"
import { assertApprovedNavigation } from "@/features/website-inspection/domain/network-policy"

const relevantPageKeywords = [
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

export function selectRelevantPage(
  links: readonly InspectionLink[],
  initialUrl: string,
): string | undefined {
  return links
    .filter((link) => {
      try {
        assertApprovedNavigation(initialUrl, link.url)
        return !sameDocument(initialUrl, link.url)
      } catch {
        return false
      }
    })
    .map((link) => ({
      url: link.url,
      score: relevantPageKeywords.reduce(
        (score, keyword, index) =>
          `${link.text} ${link.url}`.toLocaleLowerCase("pl").includes(keyword)
            ? score + relevantPageKeywords.length - index
            : score,
        0,
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.url
}

// A fragment link addresses the page already captured, and navigating to it reports no response.
function sameDocument(initialUrl: string, candidateUrl: string): boolean {
  try {
    const initial = new URL(initialUrl)
    const candidate = new URL(candidateUrl)
    initial.hash = ""
    candidate.hash = ""
    return initial.href === candidate.href
  } catch {
    return false
  }
}

export function detectInterstitial(text: string): string | undefined {
  const normalized = text.toLocaleLowerCase("en")
  if (/captcha|verify you are human|potwierdź, że jesteś człowiekiem/u.test(normalized)) {
    return "captcha"
  }
  if (/just a moment|checking your browser|access denied|automation detected/u.test(normalized)) {
    return "automation-block"
  }
  if (/sign in to continue|zaloguj się, aby kontynuować/u.test(normalized)) {
    return "authentication-required"
  }
  return undefined
}
