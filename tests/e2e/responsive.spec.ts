import { expect, test } from "@playwright/test"

/** Narrow phone, large phone, tablet, small laptop, desktop. */
const widths = [375, 640, 768, 1024, 1280] as const

const pages = [
  { path: "/", name: "Overview" },
  { path: "/runs", name: "Runs" },
  { path: "/review", name: "Review Queue" },
] as const

const settingsPages = [
  "/settings/general",
  "/settings/appearance",
  "/settings/subscription",
  "/settings/data",
  "/settings/maintenance",
] as const

for (const width of widths) {
  for (const { path, name } of pages) {
    test(`${name} fits ${width}px without sideways scrolling`, async ({ page, isMobile }) => {
      // The mobile project has its own fixed viewport; these cases set their own.
      test.skip(isMobile, "Widths are driven explicitly here")
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)

      // Columns drop away as the viewport narrows, so no table should ever need to scroll sideways.
      const overflow = await page.evaluate(() => {
        const containers = Array.from(
          document.querySelectorAll('[data-slot="table-container"]'),
        ) as HTMLElement[]
        return {
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          tables: containers.map((c) => c.scrollWidth - c.clientWidth),
        }
      })

      expect(overflow.document).toBeLessThanOrEqual(1)
      for (const table of overflow.tables) {
        expect(table).toBeLessThanOrEqual(1)
      }
    })
  }
}

test("Settings sections fit a narrow phone without sideways scrolling", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Width is driven explicitly here")
  await page.setViewportSize({ width: 375, height: 900 })

  for (const path of settingsPages) {
    await page.goto(path)
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${path} overflow`).toBeLessThanOrEqual(1)
  }
})

for (const width of [375, 768, 1024]) {
  test(`Run detail fits ${width}px without sideways scrolling`, async ({ page, isMobile }) => {
    test.skip(isMobile, "Widths are driven explicitly here")
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/runs")

    // The action column hides on narrow viewports, so this opens the run the way a reader would there.
    const firstRun = page.getByRole("cell").first()
    test.skip((await firstRun.count()) === 0, "No persisted runs to open")
    await firstRun.click()
    await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/u)

    const overflow = await page.evaluate(() => {
      const containers = Array.from(
        document.querySelectorAll('[data-slot="table-container"]'),
      ) as HTMLElement[]
      return {
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tables: containers.map((c) => c.scrollWidth - c.clientWidth),
      }
    })

    expect(overflow.document).toBeLessThanOrEqual(1)
    for (const table of overflow.tables) expect(table).toBeLessThanOrEqual(1)
  })

  test(`Runs cards view fits ${width}px without sideways scrolling`, async ({ page, isMobile }) => {
    test.skip(isMobile, "Widths are driven explicitly here")
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/runs")

    const cards = page.getByRole("radio", { name: "Cards" })
    test.skip((await cards.count()) === 0, "No persisted runs to display")
    await cards.click()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
