import type { NextConfig } from "next";

const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/config"],
  output: "standalone",
  async rewrites() {
    // Local dev: proxy /api to Nest so auth cookies are same-origin as the web app.
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
