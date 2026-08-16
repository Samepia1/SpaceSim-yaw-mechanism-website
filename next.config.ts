import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in a parent directory outside this git
  // repo; without pinning the root, Turbopack warns and could resolve modules
  // from there instead of from ./node_modules.
  turbopack: { root: __dirname },
};

export default nextConfig;
