import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Belt-and-braces: lib/icons.ts already deep-imports individual icons, but
    // this also protects the webpack build path from the barrel's ~6,000 exports.
    optimizePackageImports: ["@hugeicons/core-free-icons"],
  },
};

export default nextConfig;
