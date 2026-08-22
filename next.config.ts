import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // `pnpm run app` is how someone uses this, not how they develop it, and the framework's own
  // indicator renders over the workspace there too. Compile and runtime errors still surface.
  devIndicators: false,
}

export default nextConfig
