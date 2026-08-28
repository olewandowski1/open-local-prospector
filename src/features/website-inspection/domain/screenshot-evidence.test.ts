import { describe, expect, it } from "vitest"

import { depictsRenderedPage } from "@/features/website-inspection/domain/screenshot-evidence"

describe("screenshot evidence", () => {
  // A working garage site screenshotted as a flat preloader was called broken at confidence 0.99.
  it("rejects a screenshot too small to depict the text the page contains", () => {
    expect(depictsRenderedPage({ byteSize: 5_976 }, { renderedTextLength: 3_965 })).toBe(false)
  })

  it("accepts a screenshot large enough to depict a rendered page", () => {
    expect(depictsRenderedPage({ byteSize: 487_893 }, { renderedTextLength: 650 })).toBe(true)
  })

  it("accepts a small screenshot of a page that rendered no text", () => {
    expect(depictsRenderedPage({ byteSize: 2_855 }, { renderedTextLength: 0 })).toBe(true)
  })
})
