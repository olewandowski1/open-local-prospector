import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("includes conditional classes", () => {
    expect(cn("base", false && "hidden", true && "active")).toBe("base active")
  })

  it("keeps the last conflicting Tailwind utility", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
