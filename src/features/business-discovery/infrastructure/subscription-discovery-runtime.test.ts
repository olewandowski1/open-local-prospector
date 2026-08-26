import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  makeSubscriptionDiscoveryRuntime,
  parseStructuredOutput,
  readReportText,
} from "@/features/business-discovery/infrastructure/subscription-discovery-runtime"
import {
  onlyJsonObject,
  type RuntimeProcessRequest,
  withoutTerminalColour,
} from "@/features/runtime-settings"

const ESC = String.fromCharCode(27)

// What `opencode run` actually prints: a colour-wrapped banner, its tool trace, then the answer.
const OPENCODE_REPORT = [
  `${ESC}[0m`,
  `> build · x-preview-f-free`,
  `${ESC}[0m`,
  `${ESC}[0m◈ ${ESC}[0mExa Web Search "fryzjer Reda"`,
  `${ESC}[0m% ${ESC}[0mWebFetch https://www.orlyfryzjerstwa.pl/city-38366-reda`,
  ``,
  `Studio Fryzjerskie "Żaneta"`,
  `  https://www.orlyfryzjerstwa.pl/city-38366-reda`,
  `  Telephone seen on page: 58 352 20 67`,
].join("\n")

describe("subscription discovery runtime output", () => {
  it("hands back an OpenCode report without the colour it wrote for a terminal", () => {
    const report = readReportText("opencode", { exitCode: 0, stdout: OPENCODE_REPORT })

    expect(report).not.toContain(ESC)
    expect(report).toContain("https://www.orlyfryzjerstwa.pl/city-38366-reda")
    expect(report).toContain("58 352 20 67")
  })

  it("leaves a report from a runtime that answers in plain text alone", () => {
    expect(readReportText("codex", { exitCode: 0, stdout: "Plain report" })).toBe("Plain report")
  })

  it("unwraps a report a runtime returned inside its JSON envelope", () => {
    const stdout = JSON.stringify({ result: "Wrapped report" })

    expect(readReportText("claude", { exitCode: 0, stdout })).toBe("Wrapped report")
  })

  // OpenCode has no output-schema flag, so its answer arrives after a banner and a tool trace.
  it("finds the structured answer inside an OpenCode transcript", () => {
    const stdout = [
      `${ESC}[0m`,
      `> build · x-preview-f-free`,
      `${ESC}[0m◈ ${ESC}[0mExa Web Search "reda"`,
      "Here is the JSON you asked for:",
      "```json",
      '{ "schemaVersion": "discovery-structure-v1", "businesses": [] }',
      "```",
    ].join("\n")

    expect(parseStructuredOutput("opencode", { exitCode: 0, stdout })).toEqual({
      schemaVersion: "discovery-structure-v1",
      businesses: [],
    })
  })

  it("refuses output that holds no object at all", () => {
    expect(() => onlyJsonObject("I could not answer.")).toThrow(/no JSON object/u)
  })

  it("keeps a brace that belongs to the answer rather than stopping at the first one", () => {
    expect(onlyJsonObject('noise {"a":{"b":1}} trailing')).toBe('{"a":{"b":1}}')
  })

  it("strips cursor and colour sequences alike", () => {
    expect(withoutTerminalColour(`${ESC}[1m${ESC}[32mgreen${ESC}[0m${ESC}[2K`)).toBe("green")
  })

  it("contains OpenCode to public search for reporting and no tools for structuring", async () => {
    const requests: RuntimeProcessRequest[] = []
    const runtime = makeSubscriptionDiscoveryRuntime({ opencode: "opencode" }, (request) => {
      requests.push(request)
      return Effect.succeed({
        exitCode: 0,
        stdout:
          requests.length === 1
            ? "Fixture report"
            : '{"schemaVersion":"discovery-structure-v1","businesses":[]}',
      })
    })
    const brief = {
      runtime: "opencode" as const,
      query: "fixture",
      category: "Fixture Services",
      searchAreaName: "Fixture City",
      countryCode: "PL",
      searchLanguage: "Polish",
      wanted: 5,
    }

    const report = await Effect.runPromise(runtime.report(brief))
    await Effect.runPromise(runtime.structure(brief, report))

    const reportPolicy = JSON.parse(requests[0]?.environment?.OPENCODE_CONFIG_CONTENT ?? "")
    const structurePolicy = JSON.parse(requests[1]?.environment?.OPENCODE_CONFIG_CONTENT ?? "")
    expect(requests[0]?.arguments).toEqual(
      expect.arrayContaining(["--pure", "--agent", "open-prospector-public-search"]),
    )
    expect(reportPolicy.agent["open-prospector-public-search"].permission).toEqual({
      "*": "deny",
      websearch: "allow",
      webfetch: "allow",
    })
    expect(requests[1]?.arguments).toEqual(
      expect.arrayContaining(["--pure", "--agent", "open-prospector-no-tools"]),
    )
    expect(structurePolicy.agent["open-prospector-no-tools"].permission).toEqual({ "*": "deny" })
  })
})
