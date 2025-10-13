import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    appDir: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig;
