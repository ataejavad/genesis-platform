import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // customer files come through the chat (10 MB max, checked again on the server)
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
