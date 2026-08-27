import { describe, expect, it } from "vitest"

import { findSourceCommentStyleViolations } from "@/architecture/comment-style"

describe("comment style", () => {
  it("accepts concise single-line comments", () => {
    const source = `// Explain the constraint.\nconst value = 1\n/** Describe the public value. */\nexport { value }`

    expect(findSourceCommentStyleViolations(source, "example.ts")).toEqual([])
  })

  it("rejects block and adjacent line comments that span lines", () => {
    const source = `/**\n * Long explanation.\n */\n// First sentence.\n// Second sentence.\nconst value = 1`

    expect(findSourceCommentStyleViolations(source, "example.ts")).toEqual([
      { file: "example.ts", line: 1, message: "Comment exceeds one line." },
      {
        file: "example.ts",
        line: 5,
        message: "Adjacent line comments form a multi-line comment.",
      },
    ])
  })
})
