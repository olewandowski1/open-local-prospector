import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Hide the framework indicator in the built local app while preserving reported errors.
  devIndicators: false,
}

export default nextConfig
