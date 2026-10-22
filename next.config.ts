import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 95],
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560],
  },
};

export default nextConfig;
