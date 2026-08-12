import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Section roots redirect to their first sub-page, so the sidebar's "Settings"
  // and "Legal" links land somewhere real (and the secondary sidebar shows).
  async redirects() {
    return [
      {
        source: "/legal",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/settings/account",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
