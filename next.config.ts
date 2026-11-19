import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  experimental: {
    serverActions: {
      // qSearch accepts uploads up to 50 MB (src/app/qsearch/actions.ts),
      // plus room for multipart overhead. The default is 1 MB.
      bodySizeLimit: '51mb',
    },
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