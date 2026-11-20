import type { NextConfig } from "next";
import { applyPlatformDefaults } from "./src/lib/platform";

// the public address etc. on Vercel, also for pages built ahead (sitemap, robots)
applyPlatformDefaults();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // check-up questions, outreach templates and market-selection runs are read from data/ at run time;
  // hosts that bundle each function separately (Vercel) must ship them along
  outputFileTracingIncludes: { "/**": ["./data/checkup/**", "./data/outreach/**", "./data/market-selection/runs/**"] },
  // customer files come through the chat (10 MB max, checked again on the server)
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
