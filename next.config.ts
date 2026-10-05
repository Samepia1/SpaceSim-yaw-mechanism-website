import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in a parent directory outside this git
  // repo; without pinning the root, Turbopack warns and could resolve modules
  // from there instead of from ./node_modules.
  turbopack: { root: __dirname },

  // The FSAE dashboard is a static export in public/ (see scripts/sync-aero.mjs);
  // serve its index.html at the directory URL.
  async rewrites() {
    return [{ source: '/FSAE/Aero-data', destination: '/FSAE/Aero-data/index.html' }];
  },
};

export default nextConfig;
