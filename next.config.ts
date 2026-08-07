import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // TODO(go-live): add the production domain(s) once known — Server
      // Actions are rejected with a 403 from any origin not listed here.
      // Add Vercel's auto-generated domain first (shown in the Vercel
      // dashboard after the first deploy, e.g. "orderhub-prod.vercel.app"),
      // then the custom domain once configured in Vercel Settings, e.g.
      // "orders.hogskins.com". Keep "localhost:3000" for local dev.
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
