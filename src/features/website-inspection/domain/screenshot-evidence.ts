// A PNG this small cannot depict a rendered page, so it is a capture artifact rather than evidence of appearance.
const MINIMUM_DEPICTING_BYTES = 15_000

export function depictsRenderedPage(
  screenshot: Readonly<{ byteSize: number }>,
  page: Readonly<{ renderedTextLength: number }>,
): boolean {
  if (page.renderedTextLength === 0) return true
  return screenshot.byteSize >= MINIMUM_DEPICTING_BYTES
}
