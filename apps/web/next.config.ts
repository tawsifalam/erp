import type { NextConfig } from "next";

const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/config"],
  output: "standalone",
  experimental: {
    // Chakra generates large style modules; this trims dev cache churn and warnings.
    optimizePackageImports: ["@chakra-ui/react", "@erp/ui"],
  },
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      /Serializing big strings/,
    ];
    return config;
  },
  async rewrites() {
    // Local dev: proxy /api to Nest so auth cookies are same-origin as the web app.
    // Playwright E2E mocks API in the browser — skip proxy to avoid :3001 ECONNREFUSED noise.
    if (process.env.NODE_ENV === "production" || process.env.PLAYWRIGHT === "1") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
