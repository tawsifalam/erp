import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/config"],
  output: "standalone",
};

export default nextConfig;
