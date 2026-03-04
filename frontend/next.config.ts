import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        source: "/events",
        destination: "http://localhost:8000/events",
      },
    ];
  },
};

export default nextConfig;
