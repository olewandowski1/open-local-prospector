import { describe, expect, it } from "vitest"

import {
  detectInterstitial,
  selectRelevantPage,
} from "@/features/website-inspection/infrastructure/inspection-page-policy"

describe("inspection page policy", () => {
  it("prefers a same-site contact journey and rejects cross-site links", () => {
    expect(
      selectRelevantPage(
        [
          { text: "Contact", url: "https://attacker.example/contact" },
          { text: "Usługi", url: "https://business.example/uslugi" },
          { text: "Kontakt", url: "https://business.example/kontakt" },
        ],
        "https://business.example/",
      ),
    ).toBe("https://business.example/kontakt")
  })

  it("ignores a fragment that addresses the captured page instead of a second page", () => {
    expect(
      selectRelevantPage(
        [
          { text: "Kontakt", url: "https://business.example/#kontakt" },
          { text: "Kontakt", url: "https://business.example/" },
        ],
        "https://business.example/",
      ),
    ).toBeUndefined()
  })

  it("still prefers a real second page when a fragment also matches", () => {
    expect(
      selectRelevantPage(
        [
          { text: "Kontakt", url: "https://business.example/#kontakt" },
          { text: "Kontakt", url: "https://business.example/kontakt" },
        ],
        "https://business.example/",
      ),
    ).toBe("https://business.example/kontakt")
  })

  it("returns no page when no approved link describes a relevant journey", () => {
    expect(
      selectRelevantPage(
        [{ text: "Company history", url: "https://business.example/history" }],
        "https://business.example/",
      ),
    ).toBeUndefined()
  })

  it.each([
    ["Verify you are human with CAPTCHA", "captcha"],
    ["Just a moment while we check your browser", "automation-block"],
    ["Zaloguj się, aby kontynuować", "authentication-required"],
    ["Welcome to our services", undefined],
  ])("classifies interstitial text", (text, expected) => {
    expect(detectInterstitial(text)).toBe(expected)
  })
})
