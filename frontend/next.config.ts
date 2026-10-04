import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory confuses workspace-root detection.
  turbopack: { root: process.cwd() },
  // Enables forbidden() so role checks render a real 403 page.
  experimental: { authInterrupts: true },
  // Amplify sets AWS_JOB_ID per build. A page from an older build then reloads instead of calling a Server Action this build no longer has.
  deploymentId: process.env.AWS_JOB_ID,
  async redirects() {
    return [
      { source: "/agent", destination: "/agent/conversations", permanent: false },
      { source: "/admin", destination: "/admin/operations", permanent: false },
    ];
  },
};

export default nextConfig;
