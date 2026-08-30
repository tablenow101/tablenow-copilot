import type { NextConfig } from "next";
import { assertVercelDeploymentBoundary } from "./deployment-boundary";

assertVercelDeploymentBoundary(process.env);

const nextConfig: NextConfig = {
  ...(process.env.VERCEL === "1" ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  async rewrites() {
    if (process.env.VERCEL === "1") return [];
    const apiTarget = process.env.CORE_API_INTERNAL_URL || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiTarget}/:path*` }];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }];
  },
};

export default nextConfig;
