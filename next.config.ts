import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable sharp image optimization — the app doesn't use next/image.
  // Favicons are loaded via plain <img> tags, so this has zero impact.
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  reactCompiler: true,
};

export default nextConfig;
