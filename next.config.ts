import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  // Another lockfile exists above this folder; pin the root so Next stops guessing.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
