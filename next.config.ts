import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" lets you ship the same build to Vercel OR a Docker host
  // (e.g. an EU-only provider) without code changes.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
