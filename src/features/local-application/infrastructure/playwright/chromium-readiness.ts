import { spawnSync } from "node:child_process"
import { accessSync, constants } from "node:fs"

import { chromium } from "playwright"

export function getChromiumExecutablePath(): string {
  return chromium.executablePath()
}

export function canExecuteChromium(path = getChromiumExecutablePath()): boolean {
  try {
    accessSync(path, constants.X_OK)
    const result = spawnSync(
      path,
      ["--headless", "--no-sandbox", "--disable-gpu", "--dump-dom", "about:blank"],
      {
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    )
    return result.status === 0 && /<html/u.test(result.stdout)
  } catch {
    return false
  }
}
