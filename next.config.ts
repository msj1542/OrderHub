import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // TODO(go-live): add the production domain once it's decided, e.g.
      // "orders.hogskins.com" — Server Actions are rejected with a 403 from
      // any origin not listed here. Keep "localhost:3000" for local dev.
      allowedOrigins: ["localhost:3000"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
