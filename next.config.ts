import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  experimental: {
    serverActions: {
      // qSearch accepts uploads up to 4 MB (src/lib/qsearch/uploads.ts),
      // plus room for the form data around the file. Vercel itself rejects
      // request bodies over 4.5 MB, so a larger value would have no effect.
      bodySizeLimit: '4.5mb',
    },
  },
  async headers() {
    // Security headers for the qSearch pages. No script-src rule: Next.js
    // pages rely on inline scripts, and a nonce-based policy is a separate,
    // site-wide change.
    return [
      {
        source: '/qsearch/:path*',
        headers: [
          // HTTPS only, for two years, including any subdomains of this host.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Never shown inside another site's frame (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          // Browsers must not guess file types from content.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Other sites see only this origin, never full qSearch addresses.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // qSearch needs none of these device features.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/legal',
        destination: '/legal/privacy',
        permanent: true,
      },
      {
        source: '/settings',
        destination: '/settings/account',
        permanent: true,
      },
    ];
  },
}

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
})

export default withMDX(nextConfig)