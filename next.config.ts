import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify plugin handles output automatically
  // Keep standalone for Vercel compatibility
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Required for Netlify Functions
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
